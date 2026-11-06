import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { errorResponseSchema } from "../../common/response.js";
import { env } from "../../config/env.js";
import { authenticate } from "../../plugins/auth.js";
import { loginHandler, meHandler } from "./auth.controller.js";
import { loginBodySchema, loginResponseSchema, meResponseSchema } from "./auth.schema.js";

export async function authRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // POST /auth/login (with strict rate limiting per IP and email)
  router.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: env.LOGIN_RATE_LIMIT_MAX,
          timeWindow: "1 minute",
          keyGenerator: (req) => {
            const body = req.body as { email?: string } | undefined;
            const email = body?.email ? body.email.toLowerCase().trim() : "";
            return `${req.ip}_${email}`;
          },
        },
      },
      schema: {
        description: "User authentication / login endpoint",
        tags: ["Auth"],
        body: loginBodySchema,
        response: {
          200: loginResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    loginHandler
  );

  // GET /auth/me (authenticated user profile)
  router.get(
    "/me",
    {
      preHandler: [authenticate],
      schema: {
        description: "Retrieve currently authenticated user profile",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: meResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    meHandler
  );
}

