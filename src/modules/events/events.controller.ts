import { FastifyReply, FastifyRequest } from "fastify";
import { createSuccessResponse } from "../../common/response.js";
import {
  CreateEventBody,
  EventIdParams,
  ListEventsQuery,
  UpdateEventBody,
} from "./events.schema.js";
import { eventsService } from "./events.service.js";

export async function listEventsHandler(
  request: FastifyRequest<{ Querystring: ListEventsQuery }>,
  reply: FastifyReply
) {
  const result = await eventsService.listEvents(request.query, request.currentUser!);
  return reply.status(200).send(createSuccessResponse(result.data, result.meta));
}

export async function getEventByIdHandler(
  request: FastifyRequest<{ Params: EventIdParams }>,
  reply: FastifyReply
) {
  const result = await eventsService.getEventById(request.params.id);
  return reply.status(200).send(createSuccessResponse(result));
}

export async function createEventHandler(
  request: FastifyRequest<{ Body: CreateEventBody }>,
  reply: FastifyReply
) {
  const result = await eventsService.createEvent(request.body, request.currentUser!);
  return reply.status(201).send(createSuccessResponse(result));
}

export async function updateEventHandler(
  request: FastifyRequest<{ Params: EventIdParams; Body: UpdateEventBody }>,
  reply: FastifyReply
) {
  const result = await eventsService.updateEvent(
    request.params.id,
    request.body,
    request.currentUser!
  );
  return reply.status(200).send(createSuccessResponse(result));
}

export async function deleteEventHandler(
  request: FastifyRequest<{ Params: EventIdParams }>,
  reply: FastifyReply
) {
  await eventsService.deleteEvent(request.params.id, request.currentUser!, request.id);
  return reply.status(204).send();
}
