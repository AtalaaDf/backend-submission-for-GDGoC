import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { attendancesService } from "../../src/modules/attendances/attendances.service.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";

describe("Attendances Routes HTTP tests", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const eventId = "550e8400-e29b-41d4-a716-446655440000";
  const memberId = "550e8400-e29b-41d4-a716-446655440001";
  const adminId = "550e8400-e29b-41d4-a716-446655440002";
  const poId = "550e8400-e29b-41d4-a716-446655440003";

  it("POST /api/v1/events/:eventId/attendances should reject PO with 403 (only admin & superadmin can record attendance)", async () => {
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: poId,
      email: "po@example.com",
      fullName: "PO User",
      role: "po",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = app.jwt.sign({ sub: poId, role: "po" });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/events/${eventId}/attendances`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        memberId,
      },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("POST /api/v1/events/:eventId/attendances should return 201 on initial check-in", async () => {
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: adminId,
      email: "admin@example.com",
      fullName: "Admin User",
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const checkInData = {
      id: "550e8400-e29b-41d4-a716-446655440099",
      eventId,
      memberId,
      recordedBy: adminId,
      checkedInAt: new Date(),
      createdAt: new Date(),
    };

    vi.spyOn(attendancesService, "recordAttendance").mockResolvedValueOnce({
      data: checkInData,
      isNew: true,
    });

    const token = app.jwt.sign({ sub: adminId, role: "admin" });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/events/${eventId}/attendances`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        memberId,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.id).toBe(checkInData.id);
  });

  it("POST /api/v1/events/:eventId/attendances should return 200 on duplicate check-in (idempotency)", async () => {
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: adminId,
      email: "admin@example.com",
      fullName: "Admin User",
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const existingCheckIn = {
      id: "550e8400-e29b-41d4-a716-446655440099",
      eventId,
      memberId,
      recordedBy: adminId,
      checkedInAt: new Date(),
      createdAt: new Date(),
    };

    vi.spyOn(attendancesService, "recordAttendance").mockResolvedValueOnce({
      data: existingCheckIn,
      isNew: false, // duplicate check-in
    });

    const token = app.jwt.sign({ sub: adminId, role: "admin" });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/events/${eventId}/attendances`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        memberId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.id).toBe(existingCheckIn.id);
  });
});

