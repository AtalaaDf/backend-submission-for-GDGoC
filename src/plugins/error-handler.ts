import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../common/errors.js";
import { createErrorResponse } from "../common/response.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) => {
      const requestId = request.id;

      // 1. Business errors (AppError)
      if (error instanceof AppError) {
        const details = Array.isArray(error.details)
          ? (error.details as Array<{ field?: string; message: string }>)
          : null;
        return reply
          .status(error.statusCode)
          .send(createErrorResponse(error.code, error.message, requestId, details));
      }

      // 2. Zod validation errors
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        return reply
          .status(400)
          .send(createErrorResponse("VALIDATION_ERROR", "Input tidak valid.", requestId, details));
      }

      // 3. Fastify built-in schema validation errors
      if ("validation" in error && error.validation) {
        const details = Array.isArray(error.validation)
          ? error.validation.map((v) => ({
              field: (v as { instancePath?: string }).instancePath || undefined,
              message: (v as { message?: string }).message || "Nilai tidak valid",
            }))
          : null;
        return reply
          .status(400)
          .send(createErrorResponse("VALIDATION_ERROR", "Input tidak valid.", requestId, details));
      }

      // 4. Fastify rate-limit 429 errors
      if ("statusCode" in error && error.statusCode === 429) {
        return reply
          .status(429)
          .send(
            createErrorResponse(
              "RATE_LIMITED",
              "Terlalu banyak permintaan. Silakan coba lagi nanti.",
              requestId
            )
          );
      }

      // 5. JSON parsing or syntax errors
      if ("statusCode" in error && error.statusCode === 400) {
        return reply
          .status(400)
          .send(createErrorResponse("VALIDATION_ERROR", "Format data tidak valid.", requestId));
      }

      // 6. Unknown internal server errors (500)
      // Redact internal error message and stack trace from client response; log internally
      request.log.error(error);

      return reply
        .status(500)
        .send(
          createErrorResponse(
            "INTERNAL_ERROR",
            "Terjadi kesalahan internal pada server.",
            requestId
          )
        );
    }
  );

  // Handle 404 for unrouted endpoints
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id;
    return reply
      .status(404)
      .send(createErrorResponse("NOT_FOUND", "Rute tidak ditemukan.", requestId));
  });
}
