import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  createPaginatedResponseSchema,
  createSuccessResponseSchema,
  errorResponseSchema,
} from "../../common/response.js";
import { authenticate, authorizeRoles } from "../../plugins/auth.js";
import {
  cancelRegistrationHandler,
  listRegistrationsHandler,
  registerMemberHandler,
} from "./registrations.controller.js";
import {
  cancelRegistrationParamsSchema,
  listRegistrationsQuerySchema,
  registerMemberBodySchema,
  registrationParamsSchema,
  registrationResponseSchema,
  registrationWithMemberResponseSchema,
} from "./registrations.schema.js";

export async function registrationsRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  const allowedRolesGuard = [authenticate, authorizeRoles("superadmin", "admin", "po")];

  router.post(
    "/events/:eventId/registrations",
    {
      preHandler: allowedRolesGuard,
      schema: {
        description: "Register a member to an event with concurrency quota protection",
        tags: ["Registrations"],
        security: [{ bearerAuth: [] }],
        params: registrationParamsSchema,
        body: registerMemberBodySchema,
        response: {
          201: createSuccessResponseSchema(registrationResponseSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    registerMemberHandler
  );

  router.get(
    "/events/:eventId/registrations",
    {
      preHandler: allowedRolesGuard,
      schema: {
        description: "List registered members for an event",
        tags: ["Registrations"],
        security: [{ bearerAuth: [] }],
        params: registrationParamsSchema,
        querystring: listRegistrationsQuerySchema,
        response: {
          200: createPaginatedResponseSchema(registrationWithMemberResponseSchema),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    listRegistrationsHandler
  );

  router.delete(
    "/events/:eventId/registrations/:memberId",
    {
      preHandler: allowedRolesGuard,
      schema: {
        description: "Cancel member registration (fails if event started or attendance exists)",
        tags: ["Registrations"],
        security: [{ bearerAuth: [] }],
        params: cancelRegistrationParamsSchema,
        response: {
          204: z.null().describe("Registration cancelled successfully"),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    cancelRegistrationHandler
  );
}
