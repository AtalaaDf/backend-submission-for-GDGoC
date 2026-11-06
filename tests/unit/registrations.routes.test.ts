import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";
import { registrationsService } from "../../src/modules/registrations/registrations.service.js";

describe("Registrations Routes HTTP tests", () => {
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
  const execId = "550e8400-e29b-41d4-a716-446655440003";

  it("POST /api/v1/events/:eventId/registrations should reject executive with 403", async () => {
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: execId,
      email: "exec@example.com",
      fullName: "Executive User",
      role: "executive",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = app.jwt.sign({ sub: execId, role: "executive" });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/events/${eventId}/registrations`,
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

  it("POST /api/v1/events/:eventId/registrations should reject mass assignment body with 400", async () => {
    const token = app.jwt.sign({ sub: adminId, role: "admin" });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/events/${eventId}/registrations`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        memberId,
        registeredBy: "hacker-id", // prohibited field
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/v1/events/:eventId/registrations should allow admin to register member with 201", async () => {
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: adminId,
      email: "admin@example.com",
      fullName: "Admin User",
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(registrationsService, "registerMember").mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440099",
      eventId,
      memberId,
      registeredBy: adminId,
      createdAt: new Date(),
    });

    const token = app.jwt.sign({ sub: adminId, role: "admin" });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/events/${eventId}/registrations`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        memberId,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.id).toBe("550e8400-e29b-41d4-a716-446655440099");
    expect(body.data.eventId).toBe(eventId);
    expect(body.data.memberId).toBe(memberId);
  });

  it("GET /api/v1/events/:eventId/registrations should allow admin with 200", async () => {
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: adminId,
      email: "admin@example.com",
      fullName: "Admin User",
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(registrationsService, "listRegistrations").mockResolvedValueOnce({
      data: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });

    const token = app.jwt.sign({ sub: adminId, role: "admin" });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/events/${eventId}/registrations`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.meta).toBeDefined();
  });
});

