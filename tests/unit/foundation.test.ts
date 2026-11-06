import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

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
});

