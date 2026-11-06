import { clock } from "../../common/clock.js";
import {
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from "../../common/errors.js";
import { calculatePaginationMeta } from "../../common/pagination.js";
import { AuthenticatedUser } from "../../plugins/auth.js";
import { eventsRepository } from "../events/events.repository.js";
import { registrationsRepository } from "../registrations/registrations.repository.js";
import { attendancesRepository } from "./attendances.repository.js";
import { ListAttendancesQuery } from "./attendances.schema.js";

export const attendancesService = {
  async recordAttendance(eventId: string, memberId: string, actor: AuthenticatedUser) {
    // 1. Verify event exists and is not soft-deleted
    const event = await eventsRepository.findByIdRaw(eventId);
    if (!event || event.deletedAt !== null) {
      throw new NotFoundError("Event tidak ditemukan.");
    }

    // 2. Verify current time falls strictly within the event window [startAt, endAt]
    const now = clock.now();
    if (now.getTime() < event.startAt.getTime() || now.getTime() > event.endAt.getTime()) {
      throw new ConflictError(
        "OUTSIDE_EVENT_WINDOW",
        "Absensi hanya dapat dicatat dalam jendela waktu event berlangsung."
      );
    }

    // 3. Verify member is registered for this event
    const registration = await registrationsRepository.findByEventAndMember(eventId, memberId);
    if (!registration) {
      throw new ConflictError("NOT_REGISTERED", "Member belum terdaftar pada event ini.");
    }

    // 4. Idempotent check-in using ON CONFLICT DO NOTHING
    const inserted = await attendancesRepository.insertDoNothing({
      eventId,
      memberId,
      recordedBy: actor.id,
      checkedInAt: now,
    });

    if (inserted) {
      return { data: inserted, isNew: true };
    }

    // Already checked in: retrieve existing record and return successfully without duplicates
    const existing = await attendancesRepository.findByEventAndMember(eventId, memberId);
    if (!existing) {
      throw new InternalServerError("Gagal memuat data absensi.");
    }

    return { data: existing, isNew: false };
  },

  async listAttendances(eventId: string, query: ListAttendancesQuery, actor: AuthenticatedUser) {
    const event = await eventsRepository.findByIdRaw(eventId);
    if (!event || event.deletedAt !== null) {
      throw new NotFoundError("Event tidak ditemukan.");
    }

    // PO can only view attendance for their own events
    if (actor.role === "po" && event.createdBy !== actor.id) {
      throw new ForbiddenError("Anda tidak memiliki izin untuk melihat absensi event ini.");
    }

    const { data, total } = await attendancesRepository.findMany(eventId, query);
    const meta = calculatePaginationMeta(total, query.page, query.limit);

    return { data, meta };
  },
};
