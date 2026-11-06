import { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { ForbiddenError, UnauthorizedError } from "../../src/common/errors.js";
import { authorizeRoles } from "../../src/plugins/auth.js";

describe("Role Guard unit tests", () => {
  const dummyReply = {} as FastifyReply;

  it("should throw UnauthorizedError when request.currentUser is missing", async () => {
    const request = {} as FastifyRequest;
    const guard = authorizeRoles("superadmin", "admin");

    await expect(guard(request, dummyReply)).rejects.toThrow(UnauthorizedError);
  });

  it("should throw ForbiddenError when user role is not allowed", async () => {
    const request = {
      currentUser: {
        id: "u-1",
        email: "po@example.com",
        fullName: "PO User",
        role: "po",
      },
    } as FastifyRequest;

    const guard = authorizeRoles("superadmin", "admin");
    await expect(guard(request, dummyReply)).rejects.toThrow(ForbiddenError);
  });

  it("should pass when user role is in the allowed list", async () => {
    const request = {
      currentUser: {
        id: "u-2",
        email: "admin@example.com",
        fullName: "Admin User",
        role: "admin",
      },
    } as FastifyRequest;

    const guard = authorizeRoles("superadmin", "admin");
    await expect(guard(request, dummyReply)).resolves.toBeUndefined();
  });
});

