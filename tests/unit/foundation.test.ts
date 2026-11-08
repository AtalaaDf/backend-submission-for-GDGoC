import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { envSchema } from "../../src/config/env.js";

describe("Foundation plugins and error handling", () => {
  const app = buildApp();

  it("should return formatted 404 error for unknown routes", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/unknown-route-123",
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Rute tidak ditemukan.");
    expect(body.error.requestId).toBeDefined();
  });

  it("should serve Swagger documentation at /docs", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/docs",
    });

    // Swagger UI either redirects to /docs/ or returns 200
    expect([200, 301, 302]).toContain(response.statusCode);
  });

  it("should include security headers from Helmet", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBeDefined();
  });

  it("should reject SEED_*_PASSWORD with under 12 characters in envSchema", () => {
    const invalidResult = envSchema.safeParse({
      DATABASE_URL: "postgres://localhost:5432/db",
      JWT_SECRET: "12345678901234567890123456789012",
      SEED_ADMIN_PASSWORD: "short", // < 12 characters
    });

    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(
        invalidResult.error.issues.some((issue) => issue.path.includes("SEED_ADMIN_PASSWORD"))
      ).toBe(true);
    }
  });

  it("should accept SEED_*_PASSWORD with 12 characters or more in envSchema", () => {
    const validResult = envSchema.safeParse({
      DATABASE_URL: "postgres://localhost:5432/db",
      JWT_SECRET: "12345678901234567890123456789012",
      SEED_SUPERADMIN_PASSWORD: "SuperAdminPassword123!",
      SEED_ADMIN_PASSWORD: "AdminPassword123!",
      SEED_EXECUTIVE_PASSWORD: "ExecutivePassword123!",
      SEED_PO1_PASSWORD: "ProductOwner1Password123!",
      SEED_PO2_PASSWORD: "ProductOwner2Password123!",
    });

    expect(validResult.success).toBe(true);
  });
});
