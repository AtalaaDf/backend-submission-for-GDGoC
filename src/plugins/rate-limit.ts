import rateLimit from "@fastify/rate-limit";
import { FastifyInstance, FastifyRequest } from "fastify";
import { createErrorResponse } from "../common/response.js";
import { env } from "../config/env.js";

export function registerRateLimit(app: FastifyInstance): void {
  app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
    errorResponseBuilder: (request: FastifyRequest, context) => {
      const requestId = request.id;
      return createErrorResponse(
        "RATE_LIMITED",
        `Terlalu banyak permintaan. Batas ${context.max} permintaan per ${context.after} tercapai.`,
        requestId
      );
    },
  });
}
