import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export function registerSecurity(app: FastifyInstance): void {
  app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === "production",
  });

  app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
}
