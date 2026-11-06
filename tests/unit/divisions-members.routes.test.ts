import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";
import { divisionsRepository } from "../../src/modules/divisions/divisions.repository.js";
import { membersRepository } from "../../src/modules/members/members.repository.js";

describe("Divisions and Members Routes HTTP tests", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/v1/divisions should return 200 for any authenticated role (e.g. executive)", async () => {
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: "exec-uuid",
      email: "exec@example.com",
      fullName: "Executive User",
      role: "executive",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(divisionsRepository, "findMany").mockResolvedValueOnce({
      data: [],
      total: 0,
    });

    const token = app.jwt.sign({ sub: "exec-uuid", role: "executive" });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/divisions",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.meta).toBeDefined();
  });

  it("POST /api/v1/divisions should return 403 for non-superadmin", async () => {
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
      url: "/api/v1/divisions",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: "Cyber Security",
        type: "technical",
      },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("POST /api/v1/members should return 403 for non-superadmin", async () => {
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: "po-uuid",
      email: "po@example.com",
      fullName: "PO User",
      role: "po",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = app.jwt.sign({ sub: "po-uuid", role: "po" });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/members",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        fullName: "Test Member",
        divisionId: "550e8400-e29b-41d4-a716-446655440000",
      },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("POST /api/v1/members should reject mass assignment body with 400", async () => {
    const token = app.jwt.sign({ sub: "superadmin-uuid", role: "superadmin" });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/members",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        fullName: "Test Member",
        divisionId: "550e8400-e29b-41d4-a716-446655440000",
        deletedAt: new Date().toISOString(), // forbidden field
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/v1/members should return 200 for authenticated user", async () => {
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: "admin-uuid",
      email: "admin@example.com",
      fullName: "Admin User",
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(membersRepository, "findMany").mockResolvedValueOnce({
      data: [],
      total: 0,
    });

    const token = app.jwt.sign({ sub: "admin-uuid", role: "admin" });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/members?page=1&limit=10&sortBy=fullName&order=asc",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.meta.page).toBe(1);
  });
});
