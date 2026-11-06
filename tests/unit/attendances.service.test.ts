import { afterEach, describe, expect, it, vi } from "vitest";
import { clock } from "../../src/common/clock.js";
import { ConflictError, ForbiddenError } from "../../src/common/errors.js";
import { AuthenticatedUser } from "../../src/plugins/auth.js";
import { attendancesRepository } from "../../src/modules/attendances/attendances.repository.js";
import { attendancesService } from "../../src/modules/attendances/attendances.service.js";
import { eventsRepository } from "../../src/modules/events/events.repository.js";
import { registrationsRepository } from "../../src/modules/registrations/registrations.repository.js";

describe("Attendances Service unit tests", () => {
  afterEach(() => {
    clock.reset();
    vi.restoreAllMocks();
  });

  const admin: AuthenticatedUser = {
    id: "admin-id",
    email: "admin@example.com",
    fullName: "Admin",
    role: "admin",
  };

  const po2: AuthenticatedUser = {
    id: "po2-id",
    email: "po2@example.com",
    fullName: "PO 2",
    role: "po",
  };

  const sampleEvent = {
    id: "ev-1",
    name: "GDGoC Workshop",
    description: null,
    type: "offline" as const,
    startAt: new Date("2026-12-01T10:00:00Z"),
    endAt: new Date("2026-12-01T12:00:00Z"),
    quota: 50,
    createdBy: "po1-id",
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleReg = {
    id: "reg-1",
    eventId: "ev-1",
    memberId: "m-1",
    registeredBy: "admin-id",
    createdAt: new Date(),
  };

  it("should reject attendance outside event window (before event startAt)", async () => {
    clock.setMockTime("2026-12-01T09:30:00Z"); // Before startAt 10:00:00Z

    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(sampleEvent);

    await expect(attendancesService.recordAttendance("ev-1", "m-1", admin)).rejects.toThrow(
      new ConflictError(
        "OUTSIDE_EVENT_WINDOW",
        "Absensi hanya dapat dicatat dalam jendela waktu event berlangsung."
      )
    );
  });

  it("should reject attendance outside event window (after event endAt)", async () => {
    clock.setMockTime("2026-12-01T12:30:00Z"); // After endAt 12:00:00Z

    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(sampleEvent);

    await expect(attendancesService.recordAttendance("ev-1", "m-1", admin)).rejects.toThrow(
      new ConflictError(
        "OUTSIDE_EVENT_WINDOW",
        "Absensi hanya dapat dicatat dalam jendela waktu event berlangsung."
      )
    );
  });

  it("should reject attendance when member is not registered for the event (409 NOT_REGISTERED)", async () => {
    clock.setMockTime("2026-12-01T10:30:00Z"); // Within event window

    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(sampleEvent);
    vi.spyOn(registrationsRepository, "findByEventAndMember").mockResolvedValueOnce(null);

    await expect(
      attendancesService.recordAttendance("ev-1", "m-unregistered", admin)
    ).rejects.toThrow(
      new ConflictError("NOT_REGISTERED", "Member belum terdaftar pada event ini.")
    );
  });

  it("should succeed and return isNew: true on first check-in", async () => {
    clock.setMockTime("2026-12-01T10:30:00Z");

    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(sampleEvent);
    vi.spyOn(registrationsRepository, "findByEventAndMember").mockResolvedValueOnce(sampleReg);

    const checkInRecord = {
      id: "att-1",
      eventId: "ev-1",
      memberId: "m-1",
      recordedBy: "admin-id",
      checkedInAt: new Date("2026-12-01T10:30:00Z"),
      createdAt: new Date(),
    };

    vi.spyOn(attendancesRepository, "insertDoNothing").mockResolvedValueOnce(checkInRecord);

    const result = await attendancesService.recordAttendance("ev-1", "m-1", admin);
    expect(result.isNew).toBe(true);
    expect(result.data.id).toBe("att-1");
  });

  it("should be idempotent and return isNew: false with existing record on duplicate check-in", async () => {
    clock.setMockTime("2026-12-01T10:35:00Z");

    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(sampleEvent);
    vi.spyOn(registrationsRepository, "findByEventAndMember").mockResolvedValueOnce(sampleReg);

    const existingCheckIn = {
      id: "att-1",
      eventId: "ev-1",
      memberId: "m-1",
      recordedBy: "admin-id",
      checkedInAt: new Date("2026-12-01T10:30:00Z"),
      createdAt: new Date(),
    };

    // ON CONFLICT DO NOTHING returns null on conflict
    vi.spyOn(attendancesRepository, "insertDoNothing").mockResolvedValueOnce(null);
    vi.spyOn(attendancesRepository, "findByEventAndMember").mockResolvedValueOnce(existingCheckIn);

    const result = await attendancesService.recordAttendance("ev-1", "m-1", admin);
    expect(result.isNew).toBe(false);
    expect(result.data.id).toBe("att-1");
    expect(result.data.checkedInAt).toEqual(existingCheckIn.checkedInAt);
  });

  it("should prevent non-owner PO from viewing attendance list (403)", async () => {
    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(sampleEvent); // Owned by po1

    await expect(
      attendancesService.listAttendances(
        "ev-1",
        { page: 1, limit: 20, order: "desc", sortBy: "checkedInAt" },
        po2
      )
    ).rejects.toThrow(ForbiddenError);
  });
});
