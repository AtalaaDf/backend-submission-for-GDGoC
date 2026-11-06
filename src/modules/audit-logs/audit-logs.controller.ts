import { FastifyReply, FastifyRequest } from "fastify";
import { createSuccessResponse } from "../../common/response.js";
import { ListAuditLogsQuery } from "./audit-logs.schema.js";
import { auditLogsService } from "./audit-logs.service.js";

export async function listAuditLogsHandler(
  request: FastifyRequest<{ Querystring: ListAuditLogsQuery }>,
  reply: FastifyReply
) {
  const result = await auditLogsService.listAuditLogs(request.query);
  return reply.status(200).send(createSuccessResponse(result.data, result.meta));
}

