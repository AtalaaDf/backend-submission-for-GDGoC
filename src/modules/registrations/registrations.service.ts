import { and, eq, isNull } from "drizzle-orm";
import { recordAuditLog } from "../../common/audit.js";
import { clock } from "../../common/clock.js";
import {
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from "../../common/errors.js";
import { calculatePaginationMeta } from "../../common/pagination.js";
import { db } from "../../db/client.js";
import { events } from "../../db/schema.js";
import { AuthenticatedUser } from "../../plugins/auth.js";
import { eventsRepository } from "../events/events.repository.js";
import { membersRepository } from "../members/members.repository.js";
import { registrationsRepository } from "./registrations.repository.js";
import { ListRegistrationsQuery } from "./registrations.schema.js";

export const registrationsService = {
  async registerMember(eventId: string, memberId: string, actor: AuthenticatedUser) {
    // 1. Verify event existence and authorization
    const event = await eventsRepository.findByIdRaw(eventId);
    if (!event || event.deletedAt !== null) {
      throw new NotFoundError("Event tidak ditemukan.");
    }

    if (actor.role === "po" && event.createdBy !== actor.id) {
      throw new ForbiddenError("Anda tidak memiliki izin untuk mendaftarkan peserta ke event ini.");
    }

    // 2. Verify member is active and not soft-deleted
    const member = await membersRepository.findById(memberId);
    if (!member) {
      throw new NotFoundError("Member tidak ditemukan.");
    }
    if (member.deletedAt !== null) {
      throw new ConflictError(
        "MEMBER_DELETED",
        "Member yang telah dihapus tidak dapat didaftarkan ke event."
      );
    }

    // 3. Concurrency-safe registration in a single database transaction
    return await db.transaction(async (tx) => {
      // Lock event row with SELECT ... FOR UPDATE to serialize parallel registrations for this event
      const lockedEventRows = await tx
        .select()
        .from(events)
        .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
        .for("update")
        .limit(1);

      const lockedEvent = lockedEventRows[0];
      if (!lockedEvent) {
        throw new NotFoundError("Event tidak ditemukan.");
      }

      // Check registration window (must be before event startAt)
      if (clock.now().getTime() >= lockedEvent.startAt.getTime()) {
        throw new ConflictError(
          "REGISTRATION_CLOSED",
          "Pendaftaran untuk event ini sudah ditutup karena event telah dimulai."
        );
      }

      // Check if already registered
      const existing = await registrationsRepository.findByEventAndMember(eventId, memberId, tx);
      if (existing) {
        throw new ConflictError("ALREADY_REGISTERED", "Member sudah terdaftar pada event ini.");
      }

      // Check remaining quota
      const currentCount = await registrationsRepository.countByEventId(eventId, tx);
      if (currentCount >= lockedEvent.quota) {
        throw new ConflictError("EVENT_FULL", "Kuota event sudah penuh.");
      }

      // Insert new registration
      const newRegistration = await registrationsRepository.create(
        {
          eventId,
          memberId,
          registeredBy: actor.id,
        },
        tx
      );

      if (!newRegistration) {
        throw new InternalServerError("Gagal mendaftarkan member.");
      }

      return newRegistration;
    });
  },

  async listRegistrations(
    eventId: string,
    query: ListRegistrationsQuery,
    actor: AuthenticatedUser
  ) {
    const event = await eventsRepository.findByIdRaw(eventId);
    if (!event || event.deletedAt !== null) {
      throw new NotFoundError("Event tidak ditemukan.");
    }

    if (actor.role === "po" && event.createdBy !== actor.id) {
      throw new ForbiddenError("Anda tidak memiliki izin untuk melihat pendaftaran event ini.");
    }

    const { data, total } = await registrationsRepository.findMany(eventId, query);
    const meta = calculatePaginationMeta(total, query.page, query.limit);

    return { data, meta };
  },

  async cancelRegistration(
    eventId: string,
    memberId: string,
    actor: AuthenticatedUser,
    requestId: string
  ) {
    const event = await eventsRepository.findByIdRaw(eventId);
    if (!event || event.deletedAt !== null) {
      throw new NotFoundError("Event tidak ditemukan.");
    }

    if (actor.role === "po" && event.createdBy !== actor.id) {
      throw new ForbiddenError("Anda tidak memiliki izin untuk membatalkan pendaftaran event ini.");
    }

    if (clock.now().getTime() >= event.startAt.getTime()) {
      throw new ConflictError(
        "REGISTRATION_CLOSED",
        "Pendaftaran tidak dapat dibatalkan karena event telah dimulai."
      );
    }

    const registration = await registrationsRepository.findByEventAndMember(eventId, memberId);
    if (!registration) {
      throw new NotFoundError("Data pendaftaran tidak ditemukan.");
    }

    const hasAttended = await registrationsRepository.hasAttendance(eventId, memberId);
    if (hasAttended) {
      throw new ConflictError(
        "EVENT_HAS_ATTENDANCE",
        "Pendaftaran tidak dapat dibatalkan karena peserta sudah melakukan absensi."
      );
    }

    await db.transaction(async (tx) => {
      await registrationsRepository.delete(eventId, memberId, tx);

      await recordAuditLog(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "registration.cancelled",
          entity: "registration",
          entityId: registration.id,
          before: {
            eventId,
            memberId,
            registeredBy: registration.registeredBy,
          },
          after: null,
          requestId,
        },
        tx
      );
    });
  },
};
