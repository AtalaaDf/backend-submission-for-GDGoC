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
  createDivisionHandler,
  deleteDivisionHandler,
  listDivisionsHandler,
  updateDivisionHandler,
} from "./divisions.controller.js";
import {
  createDivisionBodySchema,
  divisionIdParamsSchema,
  divisionResponseSchema,
  listDivisionsQuerySchema,
  updateDivisionBodySchema,
} from "./divisions.schema.js";

export async function divisionsRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // All authenticated users can read divisions
  router.get(
    "/",
    {
      preHandler: [authenticate],
      schema: {
        description: "List all divisions with optional filtering and search",
        tags: ["Divisions"],
        security: [{ bearerAuth: [] }],
        querystring: listDivisionsQuerySchema,
        response: {
          200: createPaginatedResponseSchema(divisionResponseSchema),
          401: errorResponseSchema,
        },
      },
    },
    listDivisionsHandler
  );

  // Superadmin only mutations
  const superadminGuard = [authenticate, authorizeRoles("superadmin")];

  router.post(
    "/",
    {
      preHandler: superadminGuard,
      schema: {
        description: "Create a new division (superadmin only)",
        tags: ["Divisions"],
        security: [{ bearerAuth: [] }],
        body: createDivisionBodySchema,
        response: {
          201: createSuccessResponseSchema(divisionResponseSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    createDivisionHandler
  );

  router.patch(
    "/:id",
    {
      preHandler: superadminGuard,
      schema: {
        description: "Update division details (superadmin only)",
        tags: ["Divisions"],
        security: [{ bearerAuth: [] }],
        params: divisionIdParamsSchema,
        body: updateDivisionBodySchema,
        response: {
          200: createSuccessResponseSchema(divisionResponseSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    updateDivisionHandler
  );

  router.delete(
    "/:id",
    {
      preHandler: superadminGuard,
      schema: {
        description: "Hard delete division (superadmin only, fails if members exist)",
        tags: ["Divisions"],
        security: [{ bearerAuth: [] }],
        params: divisionIdParamsSchema,
        response: {
          204: z.null().describe("Division deleted successfully"),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    deleteDivisionHandler
  );
}
