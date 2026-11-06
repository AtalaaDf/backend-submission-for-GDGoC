import argon2 from "argon2";
import { describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "../../src/common/errors.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";
import { authService } from "../../src/modules/auth/auth.service.js";

describe("Auth Service unit tests", () => {
  it("should fail login when user is not found", async () => {
    vi.spyOn(authRepository, "findByEmailForAuth").mockResolvedValueOnce(null);

    await expect(
      authService.login({ email: "notfound@example.com", password: "Password123!" }, () => "token")
    ).rejects.toThrow(UnauthorizedError);
  });

  it("should fail login when user is inactive", async () => {
    vi.spyOn(authRepository, "findByEmailForAuth").mockResolvedValueOnce({
      id: "u-1",
      email: "inactive@example.com",
      passwordHash: "hash",
      fullName: "Inactive User",
      role: "admin",
      isActive: false,
    });

    await expect(
      authService.login({ email: "inactive@example.com", password: "Password123!" }, () => "token")
    ).rejects.toThrow(UnauthorizedError);
  });

  it("should fail login when password does not match", async () => {
    const passwordHash = await argon2.hash("CorrectPassword123!", { type: argon2.argon2id });
    vi.spyOn(authRepository, "findByEmailForAuth").mockResolvedValueOnce({
      id: "u-2",
      email: "user@example.com",
      passwordHash,
      fullName: "Active User",
      role: "admin",
      isActive: true,
    });

    await expect(
      authService.login({ email: "user@example.com", password: "WrongPassword123!" }, () => "token")
    ).rejects.toThrow(new UnauthorizedError("Email atau kata sandi salah."));
  });

  it("should succeed login when credentials are valid", async () => {
    const passwordHash = await argon2.hash("CorrectPassword123!", { type: argon2.argon2id });
    vi.spyOn(authRepository, "findByEmailForAuth").mockResolvedValueOnce({
      id: "u-3",
      email: "user@example.com",
      passwordHash,
      fullName: "Active User",
      role: "superadmin",
      isActive: true,
    });

    const result = await authService.login(
      { email: "user@example.com", password: "CorrectPassword123!" },
      (payload) => `mock_token_for_${payload.sub}`
    );

    expect(result.accessToken).toBe("mock_token_for_u-3");
    expect(result.expiresIn).toBe(3600);
    expect(result.user).toEqual({
      id: "u-3",
      email: "user@example.com",
      fullName: "Active User",
      role: "superadmin",
    });
  });

  it("should throw UnauthorizedError in getProfile when user not found or inactive", async () => {
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce(null);
    await expect(authService.getProfile("u-4")).rejects.toThrow(UnauthorizedError);

    vi.spyOn(authRepository, "findById").mockResolvedValueOnce({
      id: "u-5",
      email: "u5@example.com",
      fullName: "U5",
      role: "po",
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(authService.getProfile("u-5")).rejects.toThrow(UnauthorizedError);
  });
});
