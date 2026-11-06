import { recordAuditLog } from "../../common/audit.js";
import { clock } from "../../common/clock.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from "../../common/errors.js";
import { calculatePaginationMeta } from "../../common/pagination.js";
import { db } from "../../db/client.js";
import { AuthenticatedUser } from "../../plugins/auth.js";
import { eventsRepository } from "./events.repository.js";
import { CreateEventBody, ListEventsQuery, UpdateEventBody } from "./events.schema.js";

export const eventsService = {
  async listEvents(query: ListEventsQuery, actor: AuthenticatedUser) {
    const { data, total } = await eventsRepository.findMany(query, actor.id);
    const meta = calculatePaginationMeta(total, query.page, query.limit);
    return { data, meta };
  },

  async getEventById(id: string) {
    const event = await eventsRepository.findById(id);
    if (!event) {
      throw new NotFoundError("Event tidak ditemukan.");
    }
    return event;
  },

  async createEvent(input: CreateEventBody, actor: AuthenticatedUser) {
    const startDate = new Date(input.startAt);
    const endDate = new Date(input.endAt);

    if (endDate.getTime() <= startDate.getTime()) {
      throw new BadRequestError("Jam selesai (endAt) harus setelah jam mulai (startAt).");
    }

    const event = await eventsRepository.create({
      name: input.name.trim(),
      description: input.description !== undefined ? input.description.trim() : undefined,
      type: input.type,
      startAt: startDate,
      endAt: endDate,
      quota: input.quota,
      createdBy: actor.id,
    });

    if (!event) {
      throw new InternalServerError("Gagal membuat event.");
    }

    return {
      ...event,
      registeredCount: 0,
      remainingQuota: event.quota,
    };
  },

  async updateEvent(id: string, input: UpdateEventBody, actor: AuthenticatedUser) {
    const existing = await eventsRepository.findByIdRaw(id);
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundError("Event tidak ditemukan.");
    }

    // Authorization check: PO can only update own events
    if (actor.role === "po" && existing.createdBy !== actor.id) {
      throw new ForbiddenError("Anda tidak memiliki izin untuk mengubah event ini.");
    }

    const startDate = input.startAt ? new Date(input.startAt) : existing.startAt;
    const endDate = input.endAt ? new Date(input.endAt) : existing.endAt;

    if (endDate.getTime() <= startDate.getTime()) {
      throw new BadRequestError("Jam selesai (endAt) harus setelah jam mulai (startAt).");
    }

    if (input.quota !== undefined) {
      const registeredCount = await eventsRepository.countRegistrations(id);
      if (input.quota < registeredCount) {
        throw new ConflictError(
          "QUOTA_BELOW_REGISTERED",
          "Kuota tidak boleh lebih kecil dari jumlah pendaftar saat ini."
        );
      }
    }

    const updateData: {
      name?: string | undefined;
      description?: string | undefined;
      type?: ("online" | "offline") | undefined;
      startAt?: Date | undefined;
      endAt?: Date | undefined;
      quota?: number | undefined;
    } = {};

    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.description !== undefined) updateData.description = input.description.trim();
    if (input.type !== undefined) updateData.type = input.type;
    if (input.startAt !== undefined) updateData.startAt = startDate;
    if (input.endAt !== undefined) updateData.endAt = endDate;
    if (input.quota !== undefined) updateData.quota = input.quota;

    await eventsRepository.update(id, updateData);

    const updated = await eventsRepository.findById(id);
    if (!updated) {
      throw new NotFoundError("Event tidak ditemukan.");
    }

    return updated;
  },

  async deleteEvent(id: string, actor: AuthenticatedUser, requestId: string) {
    const existing = await eventsRepository.findByIdRaw(id);
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundError("Event tidak ditemukan.");
    }

    // Authorization check: PO can only delete own events
    if (actor.role === "po" && existing.createdBy !== actor.id) {
      throw new ForbiddenError("Anda tidak memiliki izin untuk menghapus event ini.");
    }

    // Cannot delete event if it already has attendances
    const attendanceCount = await eventsRepository.countAttendances(id);
    if (attendanceCount > 0) {
      throw new ConflictError(
        "EVENT_HAS_ATTENDANCE",
        "Event tidak dapat dihapus karena sudah memiliki data absensi."
      );
    }

    const now = clock.now();

    await db.transaction(async (tx) => {
      await eventsRepository.softDelete(id, tx);

      await recordAuditLog(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "event.deleted",
          entity: "event",
          entityId: id,
          before: { deletedAt: null },
          after: { deletedAt: now.toISOString() },
          requestId,
        },
        tx
      );
    });
  },
};
