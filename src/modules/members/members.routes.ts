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
  createMemberHandler,
  deleteMemberHandler,
  getMemberByIdHandler,
  listMembersHandler,
  restoreMemberHandler,
  updateMemberHandler,
} from "./members.controller.js";
import {
  createMemberBodySchema,
  listMembersQuerySchema,
  memberIdParamsSchema,
  memberResponseSchema,
  updateMemberBodySchema,
} from "./members.schema.js";

export async function membersRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // Read endpoints for all authenticated roles
  router.get(
    "/",
    {
      preHandler: [authenticate],
      schema: {
        description: "List members with filters, search, and pagination",
        tags: ["Members"],
        security: [{ bearerAuth: [] }],
        querystring: listMembersQuerySchema,
        response: {
          200: createPaginatedResponseSchema(memberResponseSchema),
          401: errorResponseSchema,
        },
      },
    },
    listMembersHandler
  );

  router.get(
    "/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get detailed member profile",
        tags: ["Members"],
        security: [{ bearerAuth: [] }],
        params: memberIdParamsSchema,
        response: {
          200: createSuccessResponseSchema(memberResponseSchema),
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    getMemberByIdHandler
  );

  // Superadmin only mutations
  const superadminGuard = [authenticate, authorizeRoles("superadmin")];

  router.post(
    "/",
    {
      preHandler: superadminGuard,
      schema: {
        description: "Add a new member to a division (superadmin only)",
        tags: ["Members"],
        security: [{ bearerAuth: [] }],
        body: createMemberBodySchema,
        response: {
          201: createSuccessResponseSchema(memberResponseSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    createMemberHandler
  );

  router.patch(
    "/:id",
    {
      preHandler: superadminGuard,
      schema: {
        description: "Update member details (superadmin only)",
        tags: ["Members"],
        security: [{ bearerAuth: [] }],
        params: memberIdParamsSchema,
        body: updateMemberBodySchema,
        response: {
          200: createSuccessResponseSchema(memberResponseSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    updateMemberHandler
  );

  router.delete(
    "/:id",
    {
      preHandler: superadminGuard,
      schema: {
        description: "Soft delete a member (superadmin only)",
        tags: ["Members"],
        security: [{ bearerAuth: [] }],
        params: memberIdParamsSchema,
        response: {
          204: z.null().describe("Member soft-deleted successfully"),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    deleteMemberHandler
  );

  router.post(
    "/:id/restore",
    {
      preHandler: superadminGuard,
      schema: {
        description: "Restore a soft-deleted member (superadmin only)",
        tags: ["Members"],
        security: [{ bearerAuth: [] }],
        params: memberIdParamsSchema,
        response: {
          200: createSuccessResponseSchema(memberResponseSchema),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    restoreMemberHandler
  );
}
