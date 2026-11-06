import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { createPaginatedResponseSchema, errorResponseSchema } from "../../common/response.js";
import { authenticate, authorizeRoles } from "../../plugins/auth.js";
import { listAuditLogsHandler } from "./audit-logs.controller.js";
import { auditLogResponseSchema, listAuditLogsQuerySchema } from "./audit-logs.schema.js";

export async function auditLogsRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // Only superadmin can view audit logs
  router.get(
    "/",
    {
      preHandler: [authenticate, authorizeRoles("superadmin")],
      schema: {
        description: "List audit logs with filtering and pagination (superadmin only)",
        tags: ["Audit Logs"],
        security: [{ bearerAuth: [] }],
        querystring: listAuditLogsQuerySchema,
        response: {
          200: createPaginatedResponseSchema(auditLogResponseSchema),
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    listAuditLogsHandler
  );
}
