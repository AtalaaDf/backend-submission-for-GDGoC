import { FastifyReply, FastifyRequest } from "fastify";
import { createSuccessResponse } from "../../common/response.js";
import {
  CreateUserBody,
  ListUsersQuery,
  UpdateUserRoleBody,
  UpdateUserStatusBody,
  UserIdParams,
} from "./users.schema.js";
import { usersService } from "./users.service.js";

export async function listUsersHandler(
  request: FastifyRequest<{ Querystring: ListUsersQuery }>,
  reply: FastifyReply
) {
  const result = await usersService.listUsers(request.query);
  return reply.status(200).send(createSuccessResponse(result.data, result.meta));
}

export async function createUserHandler(
  request: FastifyRequest<{ Body: CreateUserBody }>,
  reply: FastifyReply
) {
  const result = await usersService.createUser(request.body, request.currentUser!, request.id);
  return reply.status(201).send(createSuccessResponse(result));
}

export async function updateUserRoleHandler(
  request: FastifyRequest<{ Params: UserIdParams; Body: UpdateUserRoleBody }>,
  reply: FastifyReply
) {
  const result = await usersService.updateUserRole(
    request.params.id,
    request.body,
    request.currentUser!,
    request.id
  );
  return reply.status(200).send(createSuccessResponse(result));
}

export async function updateUserStatusHandler(
  request: FastifyRequest<{ Params: UserIdParams; Body: UpdateUserStatusBody }>,
  reply: FastifyReply
) {
  const result = await usersService.updateUserStatus(
    request.params.id,
    request.body,
    request.currentUser!,
    request.id
  );
  return reply.status(200).send(createSuccessResponse(result));
}
