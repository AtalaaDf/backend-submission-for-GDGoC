import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

describe("Health check endpoints", () => {
  const app = buildApp();

  it("GET /health should return 200 with status ok without touching database", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.status).toBe("ok");
    expect(body.data.timestamp).toBeDefined();
  });

  it("GET /health/ready should return 200 with readiness status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health/ready",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.status).toBe("ready");
    expect(body.data.database).toBe("connected");
  });
});

