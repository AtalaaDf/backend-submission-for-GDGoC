import { afterEach, describe, expect, it, vi } from "vitest";
import { clock } from "../../src/common/clock.js";
import { ConflictError, ForbiddenError } from "../../src/common/errors.js";
import { db } from "../../src/db/client.js";
import { AuthenticatedUser } from "../../src/plugins/auth.js";
import { eventsRepository } from "../../src/modules/events/events.repository.js";
import { membersRepository } from "../../src/modules/members/members.repository.js";
import { registrationsRepository } from "../../src/modules/registrations/registrations.repository.js";
import { registrationsService } from "../../src/modules/registrations/registrations.service.js";

describe("Registrations Service unit tests", () => {
  afterEach(() => {
    clock.reset();
    vi.restoreAllMocks();
  });

  const po1: AuthenticatedUser = {
    id: "po1-id",
    email: "po1@example.com",
    fullName: "PO 1",
    role: "po",
  };

  const po2: AuthenticatedUser = {
    id: "po2-id",
    email: "po2@example.com",
    fullName: "PO 2",
    role: "po",
  };

  const admin: AuthenticatedUser = {
    id: "admin-id",
    email: "admin@example.com",
    fullName: "Admin",
    role: "admin",
  };

  const sampleEvent = {
    id: "ev-1",
    name: "Tech Talk",
    description: null,
    type: "online" as const,
    startAt: new Date("2026-12-01T10:00:00Z"),
    endAt: new Date("2026-12-01T12:00:00Z"),
    quota: 10,
    createdBy: "po1-id",
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleMember = {
    id: "m-1",
    fullName: "Active Member",
    divisionId: "div-1",
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    division: {
      id: "div-1",
      name: "Web Dev",
      type: "technical" as const,
    },
  };

  it("should prevent non-owner PO from registering member to event (403)", async () => {
    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(sampleEvent);

    await expect(registrationsService.registerMember("ev-1", "m-1", po2)).rejects.toThrow(
      ForbiddenError
    );
  });

  it("should reject registering soft-deleted member", async () => {
    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(sampleEvent);
    vi.spyOn(membersRepository, "findById").mockResolvedValueOnce({
      ...sampleMember,
      deletedAt: new Date(),
    });

    await expect(registrationsService.registerMember("ev-1", "m-1", po1)).rejects.toThrow(
      ConflictError
    );
  });

  it("should reject registration when event has already started (409 REGISTRATION_CLOSED)", async () => {
    clock.setMockTime("2026-12-01T10:30:00Z"); // After startAt

    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(sampleEvent);
    vi.spyOn(membersRepository, "findById").mockResolvedValueOnce(sampleMember);

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([sampleEvent]),
            }),
          }),
        }),
      }),
    };

    vi.spyOn(db, "transaction").mockImplementationOnce(async (cb) => {
      return cb(mockTx as never);
    });

    await expect(registrationsService.registerMember("ev-1", "m-1", po1)).rejects.toThrow(
      new ConflictError(
        "REGISTRATION_CLOSED",
        "Pendaftaran untuk event ini sudah ditutup karena event telah dimulai."
      )
    );
  });

  it("should reject double registration for the same member (409 ALREADY_REGISTERED)", async () => {
    clock.setMockTime("2026-11-20T10:00:00Z"); // Before startAt

    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(sampleEvent);
    vi.spyOn(membersRepository, "findById").mockResolvedValueOnce(sampleMember);

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([sampleEvent]),
            }),
          }),
        }),
      }),
    };

    vi.spyOn(db, "transaction").mockImplementationOnce(async (cb) => {
      vi.spyOn(registrationsRepository, "findByEventAndMember").mockResolvedValueOnce({
        id: "reg-1",
        eventId: "ev-1",
        memberId: "m-1",
        registeredBy: "admin-id",
        createdAt: new Date(),
      });
      return cb(mockTx as never);
    });

    await expect(registrationsService.registerMember("ev-1", "m-1", admin)).rejects.toThrow(
      new ConflictError("ALREADY_REGISTERED", "Member sudah terdaftar pada event ini.")
    );
  });

  it("should reject registration when quota is full (409 EVENT_FULL)", async () => {
    clock.setMockTime("2026-11-20T10:00:00Z");

    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(sampleEvent);
    vi.spyOn(membersRepository, "findById").mockResolvedValueOnce(sampleMember);

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([sampleEvent]),
            }),
          }),
        }),
      }),
    };

    vi.spyOn(db, "transaction").mockImplementationOnce(async (cb) => {
      vi.spyOn(registrationsRepository, "findByEventAndMember").mockResolvedValueOnce(null);
      vi.spyOn(registrationsRepository, "countByEventId").mockResolvedValueOnce(10); // Quota is 10
      return cb(mockTx as never);
    });

    await expect(registrationsService.registerMember("ev-1", "m-1", admin)).rejects.toThrow(
      new ConflictError("EVENT_FULL", "Kuota event sudah penuh.")
    );
  });

  it("should succeed registering member when slot is available", async () => {
    clock.setMockTime("2026-11-20T10:00:00Z");

    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(sampleEvent);
    vi.spyOn(membersRepository, "findById").mockResolvedValueOnce(sampleMember);

    const createdReg = {
      id: "reg-new",
      eventId: "ev-1",
      memberId: "m-1",
      registeredBy: "admin-id",
      createdAt: new Date(),
    };

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([sampleEvent]),
            }),
          }),
        }),
      }),
    };

    vi.spyOn(db, "transaction").mockImplementationOnce(async (cb) => {
      vi.spyOn(registrationsRepository, "findByEventAndMember").mockResolvedValueOnce(null);
      vi.spyOn(registrationsRepository, "countByEventId").mockResolvedValueOnce(5); // 5/10
      vi.spyOn(registrationsRepository, "create").mockResolvedValueOnce(createdReg);
      return cb(mockTx as never);
    });

    const result = await registrationsService.registerMember("ev-1", "m-1", admin);
    expect(result.id).toBe("reg-new");
    expect(result.eventId).toBe("ev-1");
    expect(result.memberId).toBe("m-1");
  });

  it("should reject cancelling registration when attendance already exists (409)", async () => {
    clock.setMockTime("2026-11-20T10:00:00Z");

    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(sampleEvent);
    vi.spyOn(registrationsRepository, "findByEventAndMember").mockResolvedValueOnce({
      id: "reg-1",
      eventId: "ev-1",
      memberId: "m-1",
      registeredBy: "admin-id",
      createdAt: new Date(),
    });
    vi.spyOn(registrationsRepository, "hasAttendance").mockResolvedValueOnce(true);

    await expect(
      registrationsService.cancelRegistration("ev-1", "m-1", admin, "req-cancel-1")
    ).rejects.toThrow(ConflictError);
  });
});
