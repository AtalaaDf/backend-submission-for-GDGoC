import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../src/common/errors.js";
import { db } from "../../src/db/client.js";
import { AuthenticatedUser } from "../../src/plugins/auth.js";
import { usersRepository } from "../../src/modules/users/users.repository.js";
import { usersService } from "../../src/modules/users/users.service.js";

describe("Users Service unit tests", () => {
  const actor: AuthenticatedUser = {
    id: "actor-superadmin-id",
    email: "superadmin@example.com",
    fullName: "Super Admin",
    role: "superadmin",
  };

  it("should fail creating user if email already exists", async () => {
    vi.spyOn(usersRepository, "findByEmail").mockResolvedValueOnce({
      id: "existing-id",
      email: "duplicate@example.com",
    });

    await expect(
      usersService.createUser(
        {
          email: "duplicate@example.com",
          fullName: "Duplicate User",
          password: "SecurePassword123!",
          role: "admin",
        },
        actor,
        "req-1"
      )
    ).rejects.toThrow(ConflictError);
  });

  it("should prevent demoting the last active superadmin", async () => {
    vi.spyOn(usersRepository, "findById").mockResolvedValueOnce({
      id: "last-sa-id",
      email: "lastsa@example.com",
      fullName: "Last Superadmin",
      role: "superadmin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(db, "transaction").mockImplementationOnce(async (cb) => {
      vi.spyOn(usersRepository, "countActiveSuperadmins").mockResolvedValueOnce(1);
      return cb({} as never);
    });

    await expect(
      usersService.updateUserRole("last-sa-id", { role: "admin" }, actor, "req-2")
    ).rejects.toThrow(ConflictError);
  });

  it("should prevent deactivating the last active superadmin", async () => {
    vi.spyOn(usersRepository, "findById").mockResolvedValueOnce({
      id: "last-sa-id",
      email: "lastsa@example.com",
      fullName: "Last Superadmin",
      role: "superadmin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(db, "transaction").mockImplementationOnce(async (cb) => {
      vi.spyOn(usersRepository, "countActiveSuperadmins").mockResolvedValueOnce(1);
      return cb({} as never);
    });

    await expect(
      usersService.updateUserStatus("last-sa-id", { isActive: false }, actor, "req-3")
    ).rejects.toThrow(ConflictError);
  });

  it("should throw NotFoundError when user to update does not exist", async () => {
    vi.spyOn(usersRepository, "findById").mockResolvedValueOnce(null);

    await expect(
      usersService.updateUserRole("non-existent-id", { role: "admin" }, actor, "req-4")
    ).rejects.toThrow(NotFoundError);
  });
});
