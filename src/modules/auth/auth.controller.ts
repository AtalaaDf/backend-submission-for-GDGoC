import { FastifyReply, FastifyRequest } from "fastify";
import { UnauthorizedError } from "../../common/errors.js";
import { createSuccessResponse } from "../../common/response.js";
import { authService } from "./auth.service.js";
import { LoginBody } from "./auth.schema.js";

export async function loginHandler(
  request: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply
) {
  const result = await authService.login(request.body, (payload) =>
    request.server.jwt.sign(payload)
  );

  return reply.status(200).send(createSuccessResponse(result));
}

export async function meHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!request.currentUser) {
    throw new UnauthorizedError("Belum login atau token tidak valid.");
  }

  const profile = await authService.getProfile(request.currentUser.id);
  return reply.status(200).send(createSuccessResponse(profile));
}

