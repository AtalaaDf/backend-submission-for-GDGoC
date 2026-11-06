import fastifyJwt from "@fastify/jwt";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ForbiddenError, UnauthorizedError } from "../common/errors.js";
import { env } from "../config/env.js";
import { authRepository } from "../modules/auth/auth.repository.js";

export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
  role: "superadmin" | "admin" | "executive" | "po";
};

export type JwtPayload = {
  sub: string;
  role: "superadmin" | "admin" | "executive" | "po";
};

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthenticatedUser;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export function registerAuthPlugin(app: FastifyInstance): void {
  app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError("Belum login atau token tidak valid.");
  }

  const payload = request.user;
  if (!payload || !payload.sub) {
    throw new UnauthorizedError("Belum login atau token tidak valid.");
  }

  const user = await authRepository.findById(payload.sub);
  if (!user || !user.isActive) {
    throw new UnauthorizedError("Belum login atau token tidak valid.");
  }

  request.currentUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}

export function authorizeRoles(
  ...allowedRoles: Array<"superadmin" | "admin" | "executive" | "po">
) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.currentUser) {
      throw new UnauthorizedError("Belum login atau token tidak valid.");
    }

    if (!allowedRoles.includes(request.currentUser.role)) {
      throw new ForbiddenError("Anda tidak memiliki izin untuk mengakses sumber daya ini.");
    }
  };
}
