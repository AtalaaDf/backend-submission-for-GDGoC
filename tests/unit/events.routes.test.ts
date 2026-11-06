import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";
import { eventsRepository } from "../../src/modules/events/events.repository.js";

describe("Events Routes HTTP tests", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/v1/events should return 200 for any authenticated role", async () => {
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: "admin-uuid",
      email: "admin@example.com",
      fullName: "Admin User",
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(eventsRepository, "findMany").mockResolvedValueOnce({
      data: [],
      total: 0,
    });

    const token = app.jwt.sign({ sub: "admin-uuid", role: "admin" });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/events",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.meta).toBeDefined();
  });

  it("POST /api/v1/events should reject admin and executive with 403", async () => {
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: "admin-uuid",
      email: "admin@example.com",
      fullName: "Admin User",
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = app.jwt.sign({ sub: "admin-uuid", role: "admin" });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/events",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: "Tech Workshop",
        type: "online",
        startAt: "2026-12-01T10:00:00Z",
        endAt: "2026-12-01T12:00:00Z",
        quota: 50,
      },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("POST /api/v1/events should reject mass assignment body (e.g. createdBy) with 400", async () => {
    const token = app.jwt.sign({ sub: "po-uuid", role: "po" });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/events",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: "Tech Workshop",
        type: "online",
        startAt: "2026-12-01T10:00:00Z",
        endAt: "2026-12-01T12:00:00Z",
        quota: 50,
        createdBy: "550e8400-e29b-41d4-a716-446655440000", // Prohibited field
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/v1/events should allow PO to create event with 201", async () => {
    const poId = "550e8400-e29b-41d4-a716-446655440001";
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: poId,
      email: "po@example.com",
      fullName: "PO User",
      role: "po",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(eventsRepository, "create").mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Tech Workshop",
      description: null,
      type: "online",
      startAt: new Date("2026-12-01T10:00:00Z"),
      endAt: new Date("2026-12-01T12:00:00Z"),
      quota: 50,
      createdBy: poId,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = app.jwt.sign({ sub: poId, role: "po" });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/events",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: "Tech Workshop",
        type: "online",
        startAt: "2026-12-01T10:00:00Z",
        endAt: "2026-12-01T12:00:00Z",
        quota: 50,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(body.data.remainingQuota).toBe(50);
  });
});
