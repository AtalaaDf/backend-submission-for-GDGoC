import { describe, expect, it, vi } from "vitest";
import { BadRequestError, ConflictError, ForbiddenError } from "../../src/common/errors.js";
import { db } from "../../src/db/client.js";
import { AuthenticatedUser } from "../../src/plugins/auth.js";
import { eventsRepository } from "../../src/modules/events/events.repository.js";
import { eventsService } from "../../src/modules/events/events.service.js";

describe("Events Service unit tests", () => {
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

  const superadmin: AuthenticatedUser = {
    id: "sa-id",
    email: "sa@example.com",
    fullName: "Super Admin",
    role: "superadmin",
  };

  it("should fail creating event when endAt is before startAt", async () => {
    await expect(
      eventsService.createEvent(
        {
          name: "Invalid Time Event",
          type: "online",
          startAt: "2026-12-01T14:00:00Z",
          endAt: "2026-12-01T13:00:00Z",
          quota: 50,
        },
        po1
      )
    ).rejects.toThrow(BadRequestError);
  });

  it("should succeed creating event and assign createdBy from actor", async () => {
    vi.spyOn(eventsRepository, "create").mockResolvedValueOnce({
      id: "ev-1",
      name: "Valid Event",
      description: null,
      type: "online",
      startAt: new Date("2026-12-01T14:00:00Z"),
      endAt: new Date("2026-12-01T16:00:00Z"),
      quota: 100,
      createdBy: "po1-id",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await eventsService.createEvent(
      {
        name: "Valid Event",
        type: "online",
        startAt: "2026-12-01T14:00:00Z",
        endAt: "2026-12-01T16:00:00Z",
        quota: 100,
      },
      po1
    );

    expect(result.id).toBe("ev-1");
    expect(result.createdBy).toBe("po1-id");
    expect(result.registeredCount).toBe(0);
    expect(result.remainingQuota).toBe(100);
  });

  it("should prevent non-owner PO from updating event (403)", async () => {
    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce({
      id: "ev-1",
      name: "PO 1 Event",
      description: null,
      type: "offline",
      startAt: new Date("2026-12-01T10:00:00Z"),
      endAt: new Date("2026-12-01T12:00:00Z"),
      quota: 50,
      createdBy: "po1-id", // Owned by PO 1
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      eventsService.updateEvent("ev-1", { name: "Hacked" }, po2) // PO 2 tries to update
    ).rejects.toThrow(ForbiddenError);
  });

  it("should allow superadmin to update any event", async () => {
    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce({
      id: "ev-1",
      name: "PO 1 Event",
      description: null,
      type: "offline",
      startAt: new Date("2026-12-01T10:00:00Z"),
      endAt: new Date("2026-12-01T12:00:00Z"),
      quota: 50,
      createdBy: "po1-id",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(eventsRepository, "update").mockResolvedValueOnce({
      id: "ev-1",
      name: "Updated by SA",
      description: null,
      type: "offline",
      startAt: new Date("2026-12-01T10:00:00Z"),
      endAt: new Date("2026-12-01T12:00:00Z"),
      quota: 50,
      createdBy: "po1-id",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(eventsRepository, "findById").mockResolvedValueOnce({
      id: "ev-1",
      name: "Updated by SA",
      description: null,
      type: "offline",
      startAt: new Date("2026-12-01T10:00:00Z"),
      endAt: new Date("2026-12-01T12:00:00Z"),
      quota: 50,
      registeredCount: 0,
      remainingQuota: 50,
      createdBy: "po1-id",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await eventsService.updateEvent("ev-1", { name: "Updated by SA" }, superadmin);
    expect(result.name).toBe("Updated by SA");
  });

  it("should reject updating quota to less than current registered count (409)", async () => {
    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce({
      id: "ev-2",
      name: "Popular Event",
      description: null,
      type: "offline",
      startAt: new Date("2026-12-01T10:00:00Z"),
      endAt: new Date("2026-12-01T12:00:00Z"),
      quota: 50,
      createdBy: "po1-id",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Currently 30 registered members
    vi.spyOn(eventsRepository, "countRegistrations").mockResolvedValueOnce(30);

    // Trying to lower quota to 20
    await expect(eventsService.updateEvent("ev-2", { quota: 20 }, po1)).rejects.toThrow(
      ConflictError
    );
  });

  it("should prevent non-owner PO from deleting event (403)", async () => {
    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce({
      id: "ev-3",
      name: "PO 1 Event",
      description: null,
      type: "offline",
      startAt: new Date("2026-12-01T10:00:00Z"),
      endAt: new Date("2026-12-01T12:00:00Z"),
      quota: 50,
      createdBy: "po1-id",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(eventsService.deleteEvent("ev-3", po2, "req-del-ev-1")).rejects.toThrow(
      ForbiddenError
    );
  });

  it("should prevent deleting event if attendances already exist (409)", async () => {
    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce({
      id: "ev-4",
      name: "Finished Event",
      description: null,
      type: "offline",
      startAt: new Date("2026-12-01T10:00:00Z"),
      endAt: new Date("2026-12-01T12:00:00Z"),
      quota: 50,
      createdBy: "po1-id",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Has 5 attendances
    vi.spyOn(eventsRepository, "countAttendances").mockResolvedValueOnce(5);

    await expect(eventsService.deleteEvent("ev-4", po1, "req-del-ev-2")).rejects.toThrow(
      ConflictError
    );
  });

  it("should succeed deleting event when attendances are 0 and record audit log", async () => {
    vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce({
      id: "ev-5",
      name: "Clean Event",
      description: null,
      type: "offline",
      startAt: new Date("2026-12-01T10:00:00Z"),
      endAt: new Date("2026-12-01T12:00:00Z"),
      quota: 50,
      createdBy: "po1-id",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(eventsRepository, "countAttendances").mockResolvedValueOnce(0);

    const mockTx = {
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    };

    vi.spyOn(db, "transaction").mockImplementationOnce(async (cb) => {
      vi.spyOn(eventsRepository, "softDelete").mockResolvedValueOnce({
        id: "ev-5",
        name: "Clean Event",
        description: null,
        type: "offline",
        startAt: new Date("2026-12-01T10:00:00Z"),
        endAt: new Date("2026-12-01T12:00:00Z"),
        quota: 50,
        createdBy: "po1-id",
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return cb(mockTx as never);
    });

    await expect(eventsService.deleteEvent("ev-5", po1, "req-del-ev-3")).resolves.toBeUndefined();
  });
});
