import { z } from "zod";
import { paginationQuerySchema } from "../../common/pagination.js";
import { divisionTypeZodEnum } from "../divisions/divisions.schema.js";

export const memberDivisionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: divisionTypeZodEnum,
});

export const memberResponseSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  division: memberDivisionSchema,
  deletedAt: z.string().or(z.date()).nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const createMemberBodySchema = z
  .object({
    fullName: z.string().min(1, "Nama lengkap tidak boleh kosong."),
    divisionId: z.string().uuid("divisionId harus berupa UUID."),
  })
  .strict();

export const updateMemberBodySchema = z
  .object({
    fullName: z.string().min(1, "Nama lengkap tidak boleh kosong.").optional(),
    divisionId: z.string().uuid("divisionId harus berupa UUID.").optional(),
  })
  .strict()
  .refine((data) => data.fullName !== undefined || data.divisionId !== undefined, {
    message: "Minimal satu field harus diisi untuk pembaruan.",
  });

export const memberIdParamsSchema = z
  .object({
    id: z.string().uuid("ID member harus berupa UUID."),
  })
  .strict();

export const listMembersQuerySchema = paginationQuerySchema
  .extend({
    q: z.string().optional(),
    divisionId: z.string().uuid("divisionId harus berupa UUID.").optional(),
    divisionType: divisionTypeZodEnum.optional(),
    includeDeleted: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    sortBy: z.enum(["fullName", "createdAt"]).default("fullName"),
  })
  .strict();

export type CreateMemberBody = z.infer<typeof createMemberBodySchema>;
export type UpdateMemberBody = z.infer<typeof updateMemberBodySchema>;
export type MemberIdParams = z.infer<typeof memberIdParamsSchema>;
export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
export type MemberResponse = z.infer<typeof memberResponseSchema>;
