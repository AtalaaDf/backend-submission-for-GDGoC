import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { getHealthHandler, getReadyHandler } from "./health.controller.js";
import { healthResponseSchema, readyResponseSchema } from "./health.schema.js";

export async function healthRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.get(
    "/health",
    {
      schema: {
        description: "Liveness probe for keep-alive monitoring (does not touch database)",
        tags: ["Health"],
        response: {
          200: healthResponseSchema,
        },
      },
    },
    getHealthHandler
  );

  router.get(
    "/health/ready",
    {
      schema: {
        description: "Readiness probe to verify database connectivity",
        tags: ["Health"],
        response: {
          200: readyResponseSchema,
          503: readyResponseSchema,
        },
      },
    },
    getReadyHandler
  );
}
