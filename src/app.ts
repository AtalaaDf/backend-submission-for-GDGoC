import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { env } from "./config/env.js";
import { attendancesRoutes } from "./modules/attendances/attendances.routes.js";
import { auditLogsRoutes } from "./modules/audit-logs/audit-logs.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { divisionsRoutes } from "./modules/divisions/divisions.routes.js";
import { eventsRoutes } from "./modules/events/events.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { membersRoutes } from "./modules/members/members.routes.js";
import { registrationsRoutes } from "./modules/registrations/registrations.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { registerAuthPlugin } from "./plugins/auth.js";
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

  // JWT authentication plugin
  registerAuthPlugin(app);

  // OpenAPI Swagger & Swagger UI documentation (/docs)
  registerSwagger(app);

  // Global error handler & 404 handler
  registerErrorHandler(app);

  // Liveness and Readiness probes
  app.register(healthRoutes);

  // API v1 Modules
  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(usersRoutes, { prefix: "/api/v1/users" });
  app.register(auditLogsRoutes, { prefix: "/api/v1/audit-logs" });
  app.register(divisionsRoutes, { prefix: "/api/v1/divisions" });
  app.register(membersRoutes, { prefix: "/api/v1/members" });
  app.register(eventsRoutes, { prefix: "/api/v1/events" });
  app.register(registrationsRoutes, { prefix: "/api/v1" });
  app.register(attendancesRoutes, { prefix: "/api/v1" });

  return app;
}

const app = buildApp();

// In Vercel zero-config Fastify deployment, listen call triggers function routing
if (process.env.VERCEL === "1") {
  app.listen({ port: env.PORT, host: "0.0.0.0" });
}

export default app;
