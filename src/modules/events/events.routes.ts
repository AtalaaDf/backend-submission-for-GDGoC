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
  createEventHandler,
  deleteEventHandler,
  getEventByIdHandler,
  listEventsHandler,
  updateEventHandler,
} from "./events.controller.js";
import {
  createEventBodySchema,
  eventIdParamsSchema,
  eventResponseSchema,
  listEventsQuerySchema,
  updateEventBodySchema,
} from "./events.schema.js";

export async function eventsRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // Read endpoints for all authenticated users
  router.get(
    "/",
    {
      preHandler: [authenticate],
      schema: {
        description: "List events with quota details, date range filter, and search",
        tags: ["Events"],
        security: [{ bearerAuth: [] }],
        querystring: listEventsQuerySchema,
        response: {
          200: createPaginatedResponseSchema(eventResponseSchema),
          401: errorResponseSchema,
        },
      },
    },
    listEventsHandler
  );

  router.get(
    "/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get single event detail with quota calculations",
        tags: ["Events"],
        security: [{ bearerAuth: [] }],
        params: eventIdParamsSchema,
        response: {
          200: createSuccessResponseSchema(eventResponseSchema),
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    getEventByIdHandler
  );

  // Mutations: superadmin and po
  const poAndSuperadminGuard = [authenticate, authorizeRoles("superadmin", "po")];

  router.post(
    "/",
    {
      preHandler: poAndSuperadminGuard,
      schema: {
        description: "Create a new event (superadmin or po)",
        tags: ["Events"],
        security: [{ bearerAuth: [] }],
        body: createEventBodySchema,
        response: {
          201: createSuccessResponseSchema(eventResponseSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    createEventHandler
  );

  router.patch(
    "/:id",
    {
      preHandler: poAndSuperadminGuard,
      schema: {
        description: "Update event details (superadmin or event owner po)",
        tags: ["Events"],
        security: [{ bearerAuth: [] }],
        params: eventIdParamsSchema,
        body: updateEventBodySchema,
        response: {
          200: createSuccessResponseSchema(eventResponseSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    updateEventHandler
  );

  router.delete(
    "/:id",
    {
      preHandler: poAndSuperadminGuard,
      schema: {
        description: "Soft delete event (superadmin or event owner po, fails if attendances exist)",
        tags: ["Events"],
        security: [{ bearerAuth: [] }],
        params: eventIdParamsSchema,
        response: {
          204: z.null().describe("Event soft-deleted successfully"),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    deleteEventHandler
  );
}
