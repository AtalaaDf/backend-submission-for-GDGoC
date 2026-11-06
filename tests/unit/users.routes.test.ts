import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { auditLogsRepository } from "../../src/modules/audit-logs/audit-logs.repository.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";

describe("Users and Audit Logs Routes HTTP tests", () => {
  const app = buildApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/v1/users should return 401 when unauthenticated", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/users",
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("GET /api/v1/users should return 403 when authenticated as non-superadmin (e.g. admin)", async () => {
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
      method: "GET",
      url: "/api/v1/users",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("POST /api/v1/users should return 400 when password is under 12 characters", async () => {
    const token = app.jwt.sign({ sub: "superadmin-uuid", role: "superadmin" });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        email: "newuser@example.com",
        fullName: "New User",
        password: "short", // < 12 characters
        role: "admin",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("PATCH /api/v1/users/:id/role should reject unknown body fields (mass assignment prevention)", async () => {
    const token = app.jwt.sign({ sub: "superadmin-uuid", role: "superadmin" });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        role: "admin",
        hackField: "unauthorized",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/v1/audit-logs should return 403 for non-superadmin and 200 for superadmin", async () => {
    // Non-superadmin
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: "po-uuid",
      email: "po@example.com",
      fullName: "PO User",
      role: "po",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const poToken = app.jwt.sign({ sub: "po-uuid", role: "po" });

    const forbiddenResponse = await app.inject({
      method: "GET",
      url: "/api/v1/audit-logs",
      headers: {
        authorization: `Bearer ${poToken}`,
      },
    });
    expect(forbiddenResponse.statusCode).toBe(403);

    // Superadmin
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: "superadmin-uuid",
      email: "superadmin@example.com",
      fullName: "Super Admin",
      role: "superadmin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(auditLogsRepository, "findMany").mockResolvedValueOnce({
      data: [],
      total: 0,
    });

    const saToken = app.jwt.sign({ sub: "superadmin-uuid", role: "superadmin" });

    const successResponse = await app.inject({
      method: "GET",
      url: "/api/v1/audit-logs",
      headers: {
        authorization: `Bearer ${saToken}`,
      },
    });
    expect(successResponse.statusCode).toBe(200);
  });
});
