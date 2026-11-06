import { describe, expect, it } from "vitest";
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from "../../src/common/errors.js";

describe("AppError and specialized error classes", () => {
  it("should create AppError with custom status and code", () => {
    const error = new AppError(418, "TEAPOT", "I am a teapot");
    expect(error.statusCode).toBe(418);
    expect(error.code).toBe("TEAPOT");
    expect(error.message).toBe("I am a teapot");
  });

  it("should create BadRequestError with 400 status", () => {
    const error = new BadRequestError("Invalid input", [{ field: "name", message: "Required" }]);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Invalid input");
    expect(error.details).toEqual([{ field: "name", message: "Required" }]);
  });

  it("should create UnauthorizedError with 401 status", () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("should create ForbiddenError with 403 status", () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
  });

  it("should create NotFoundError with 404 status", () => {
    const error = new NotFoundError();
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
  });

  it("should create ConflictError with 409 status and custom code", () => {
    const error = new ConflictError("EVENT_FULL", "Event quota full");
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe("EVENT_FULL");
  });

  it("should create TooManyRequestsError with 429 status", () => {
    const error = new TooManyRequestsError();
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe("RATE_LIMITED");
  });

  it("should create InternalServerError with 500 status", () => {
    const error = new InternalServerError();
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("INTERNAL_ERROR");
  });
});

