import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { env } from "./config/env.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerRateLimit } from "./plugins/rate-limit.js";
import { registerSecurity } from "./plugins/security.js";
import { registerSwagger } from "./plugins/swagger.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : env.NODE_ENV === "production" ? "info" : "debug",
      redact: {
        paths: [
          "req.headers.authorization",
          "headers.authorization",
          "req.body.password",
          "body.password",
          "*.password",
          "*.password_hash",
          "*.passwordHash",
          "*.token",
          "*.accessToken",
        ],
        censor: "[REDACTED]",
      },
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Security headers & CORS
  registerSecurity(app);

  // Rate limiting
  registerRateLimit(app);

  // OpenAPI Swagger & Swagger UI documentation (/docs)
  registerSwagger(app);

  // Global error handler & 404 handler
  registerErrorHandler(app);

  // Liveness and Readiness probes
  app.register(healthRoutes);

  return app;
}
