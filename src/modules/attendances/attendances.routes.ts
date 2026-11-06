import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  createPaginatedResponseSchema,
  createSuccessResponseSchema,
  errorResponseSchema,
} from "../../common/response.js";
import { authenticate, authorizeRoles } from "../../plugins/auth.js";
import { listAttendancesHandler, recordAttendanceHandler } from "./attendances.controller.js";
import {
  attendanceParamsSchema,
  attendanceResponseSchema,
  attendanceWithMemberResponseSchema,
  listAttendancesQuerySchema,
  recordAttendanceBodySchema,
} from "./attendances.schema.js";

export async function attendancesRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // Only superadmin and admin can record attendance
  router.post(
    "/events/:eventId/attendances",
    {
      preHandler: [authenticate, authorizeRoles("superadmin", "admin")],
      schema: {
        description:
          "Record attendance for a registered member (idempotent, 201 on first check-in, 200 on subsequent check-in)",
        tags: ["Attendances"],
        security: [{ bearerAuth: [] }],
        params: attendanceParamsSchema,
        body: recordAttendanceBodySchema,
        response: {
          200: createSuccessResponseSchema(attendanceResponseSchema),
          201: createSuccessResponseSchema(attendanceResponseSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    recordAttendanceHandler
  );

  // Superadmin, admin, and PO (own event) can view attendance list
  router.get(
    "/events/:eventId/attendances",
    {
      preHandler: [authenticate, authorizeRoles("superadmin", "admin", "po")],
      schema: {
        description: "List attendance records for an event",
        tags: ["Attendances"],
        security: [{ bearerAuth: [] }],
        params: attendanceParamsSchema,
        querystring: listAttendancesQuerySchema,
        response: {
          200: createPaginatedResponseSchema(attendanceWithMemberResponseSchema),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    listAttendancesHandler
  );
}
