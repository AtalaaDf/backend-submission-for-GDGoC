import { FastifyReply, FastifyRequest } from "fastify";
import { createSuccessResponse } from "../../common/response.js";
import {
  CreateMemberBody,
  ListMembersQuery,
  MemberIdParams,
  UpdateMemberBody,
} from "./members.schema.js";
import { membersService } from "./members.service.js";

export async function listMembersHandler(
  request: FastifyRequest<{ Querystring: ListMembersQuery }>,
  reply: FastifyReply
) {
  const result = await membersService.listMembers(request.query, request.currentUser!);
  return reply.status(200).send(createSuccessResponse(result.data, result.meta));
}

export async function getMemberByIdHandler(
  request: FastifyRequest<{ Params: MemberIdParams }>,
  reply: FastifyReply
) {
  const result = await membersService.getMemberById(request.params.id, request.currentUser!);
  return reply.status(200).send(createSuccessResponse(result));
}

export async function createMemberHandler(
  request: FastifyRequest<{ Body: CreateMemberBody }>,
  reply: FastifyReply
) {
  const result = await membersService.createMember(request.body);
  return reply.status(201).send(createSuccessResponse(result));
}

export async function updateMemberHandler(
  request: FastifyRequest<{ Params: MemberIdParams; Body: UpdateMemberBody }>,
  reply: FastifyReply
) {
  const result = await membersService.updateMember(request.params.id, request.body);
  return reply.status(200).send(createSuccessResponse(result));
}

export async function deleteMemberHandler(
  request: FastifyRequest<{ Params: MemberIdParams }>,
  reply: FastifyReply
) {
  await membersService.deleteMember(request.params.id, request.currentUser!, request.id);
  return reply.status(204).send();
}

export async function restoreMemberHandler(
  request: FastifyRequest<{ Params: MemberIdParams }>,
  reply: FastifyReply
) {
  const result = await membersService.restoreMember(
    request.params.id,
    request.currentUser!,
    request.id
  );
  return reply.status(200).send(createSuccessResponse(result));
}
