import { FastifyReply, FastifyRequest } from "fastify";
import { createSuccessResponse } from "../../common/response.js";
import {
  CancelRegistrationParams,
  ListRegistrationsQuery,
  RegisterMemberBody,
  RegistrationParams,
} from "./registrations.schema.js";
import { registrationsService } from "./registrations.service.js";

export async function registerMemberHandler(
  request: FastifyRequest<{
    Params: RegistrationParams;
    Body: RegisterMemberBody;
  }>,
  reply: FastifyReply
) {
  const result = await registrationsService.registerMember(
    request.params.eventId,
    request.body.memberId,
    request.currentUser!
  );
  return reply.status(201).send(createSuccessResponse(result));
}

export async function listRegistrationsHandler(
  request: FastifyRequest<{
    Params: RegistrationParams;
    Querystring: ListRegistrationsQuery;
  }>,
  reply: FastifyReply
) {
  const result = await registrationsService.listRegistrations(
    request.params.eventId,
    request.query,
    request.currentUser!
  );
  return reply.status(200).send(createSuccessResponse(result.data, result.meta));
}

export async function cancelRegistrationHandler(
  request: FastifyRequest<{
    Params: CancelRegistrationParams;
  }>,
  reply: FastifyReply
) {
  await registrationsService.cancelRegistration(
    request.params.eventId,
    request.params.memberId,
    request.currentUser!,
    request.id
  );
  return reply.status(204).send();
}

