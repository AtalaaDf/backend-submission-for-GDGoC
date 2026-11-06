import { FastifyReply, FastifyRequest } from "fastify";
import { createSuccessResponse } from "../../common/response.js";
import {
  CreateDivisionBody,
  DivisionIdParams,
  ListDivisionsQuery,
  UpdateDivisionBody,
} from "./divisions.schema.js";
import { divisionsService } from "./divisions.service.js";

export async function listDivisionsHandler(
  request: FastifyRequest<{ Querystring: ListDivisionsQuery }>,
  reply: FastifyReply
) {
  const result = await divisionsService.listDivisions(request.query);
  return reply.status(200).send(createSuccessResponse(result.data, result.meta));
}

export async function createDivisionHandler(
  request: FastifyRequest<{ Body: CreateDivisionBody }>,
  reply: FastifyReply
) {
  const result = await divisionsService.createDivision(request.body);
  return reply.status(201).send(createSuccessResponse(result));
}

export async function updateDivisionHandler(
  request: FastifyRequest<{ Params: DivisionIdParams; Body: UpdateDivisionBody }>,
  reply: FastifyReply
) {
  const result = await divisionsService.updateDivision(request.params.id, request.body);
  return reply.status(200).send(createSuccessResponse(result));
}

export async function deleteDivisionHandler(
  request: FastifyRequest<{ Params: DivisionIdParams }>,
  reply: FastifyReply
) {
  await divisionsService.deleteDivision(request.params.id, request.currentUser!, request.id);
  return reply.status(204).send();
}
