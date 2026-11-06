import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

describe("Auth Routes HTTP tests", () => {
  const app = buildApp();

  it("POST /api/v1/auth/login should reject invalid email format with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "not-an-email",
        password: "ValidPassword123!",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/v1/auth/login should reject unexpected body fields (mass assignment prevention)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "user@example.com",
        password: "ValidPassword123!",
        role: "superadmin",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/v1/auth/me should return 401 when Authorization header is missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Belum login atau token tidak valid.");
  });

  it("GET /api/v1/auth/me should return 401 when token is invalid", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        authorization: "Bearer invalid_token_12345",
      },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
