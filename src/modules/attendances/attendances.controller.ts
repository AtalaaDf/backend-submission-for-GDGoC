import { FastifyReply, FastifyRequest } from "fastify";
import { createSuccessResponse } from "../../common/response.js";
import {
  AttendanceParams,
  ListAttendancesQuery,
  RecordAttendanceBody,
} from "./attendances.schema.js";
import { attendancesService } from "./attendances.service.js";

export async function recordAttendanceHandler(
  request: FastifyRequest<{
    Params: AttendanceParams;
    Body: RecordAttendanceBody;
  }>,
  reply: FastifyReply
) {
  const { data, isNew } = await attendancesService.recordAttendance(
    request.params.eventId,
    request.body.memberId,
    request.currentUser!
  );

  return reply.status(isNew ? 201 : 200).send(createSuccessResponse(data));
}

export async function listAttendancesHandler(
  request: FastifyRequest<{
    Params: AttendanceParams;
    Querystring: ListAttendancesQuery;
  }>,
  reply: FastifyReply
) {
  const result = await attendancesService.listAttendances(
    request.params.eventId,
    request.query,
    request.currentUser!
  );

  return reply.status(200).send(createSuccessResponse(result.data, result.meta));
}
