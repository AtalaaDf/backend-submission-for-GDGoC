import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  createPaginatedResponseSchema,
  createSuccessResponseSchema,
  errorResponseSchema,
} from "../../common/response.js";
import { authenticate, authorizeRoles } from "../../plugins/auth.js";
import {
  createUserHandler,
  listUsersHandler,
  updateUserRoleHandler,
  updateUserStatusHandler,
} from "./users.controller.js";
import {
  createUserBodySchema,
  listUsersQuerySchema,
  updateUserRoleBodySchema,
  updateUserStatusBodySchema,
  userIdParamsSchema,
  userResponseSchema,
} from "./users.schema.js";

export async function usersRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // Only superadmin can manage users
  const superadminGuard = [authenticate, authorizeRoles("superadmin")];

  router.get(
    "/",
    {
      preHandler: superadminGuard,
      schema: {
        description: "List users with filters, search, and pagination (superadmin only)",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        querystring: listUsersQuerySchema,
        response: {
          200: createPaginatedResponseSchema(userResponseSchema),
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    listUsersHandler
  );

  router.post(
    "/",
    {
      preHandler: superadminGuard,
      schema: {
        description: "Create a new user account (superadmin only)",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        body: createUserBodySchema,
        response: {
          201: createSuccessResponseSchema(userResponseSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    createUserHandler
  );

  router.patch(
    "/:id/role",
    {
      preHandler: superadminGuard,
      schema: {
        description: "Update user role (superadmin only)",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        params: userIdParamsSchema,
        body: updateUserRoleBodySchema,
        response: {
          200: createSuccessResponseSchema(userResponseSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    updateUserRoleHandler
  );

  router.patch(
    "/:id/status",
    {
      preHandler: superadminGuard,
      schema: {
        description: "Update user active status (superadmin only)",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        params: userIdParamsSchema,
        body: updateUserStatusBodySchema,
        response: {
          200: createSuccessResponseSchema(userResponseSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    updateUserStatusHandler
  );
}
