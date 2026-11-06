import argon2 from "argon2";
import { UnauthorizedError } from "../../common/errors.js";
import { env } from "../../config/env.js";
import { JwtPayload } from "../../plugins/auth.js";
import { authRepository } from "./auth.repository.js";
import { LoginBody, UserProfile } from "./auth.schema.js";

function parseExpiresInToSeconds(expiresInStr: string): number {
  if (/^\d+$/.test(expiresInStr)) {
    return parseInt(expiresInStr, 10);
  }
  const match = expiresInStr.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) {
    return 3600;
  }
  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s":
      return val;
    case "m":
      return val * 60;
    case "h":
      return val * 3600;
    case "d":
      return val * 86400;
    default:
      return 3600;
  }
}

export const authService = {
  async login(
    input: LoginBody,
    signToken: (payload: JwtPayload) => string
  ): Promise<{ accessToken: string; expiresIn: number; user: UserProfile }> {
    const user = await authRepository.findByEmailForAuth(input.email);

    // Constant message for invalid email, invalid password, or inactive account
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Email atau kata sandi salah.");
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, input.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Email atau kata sandi salah.");
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
    };

    const accessToken = signToken(payload);
    const expiresIn = parseExpiresInToSeconds(env.JWT_EXPIRES_IN);

    return {
      accessToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  },

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await authRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Belum login atau token tidak valid.");
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  },
};
