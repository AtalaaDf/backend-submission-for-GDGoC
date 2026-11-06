import { z } from "zod";
import { paginationQuerySchema } from "../../common/pagination.js";

export const userRoleZodEnum = z.enum(["superadmin", "admin", "executive", "po"]);

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  role: userRoleZodEnum,
  isActive: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const createUserBodySchema = z
  .object({
    email: z.string().email("Format email tidak valid."),
    fullName: z.string().min(1, "Nama lengkap tidak boleh kosong."),
    password: z.string().min(12, "Kata sandi minimal 12 karakter."),
    role: userRoleZodEnum,
  })
  .strict();

export const updateUserRoleBodySchema = z
  .object({
    role: userRoleZodEnum,
  })
  .strict();

export const updateUserStatusBodySchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const userIdParamsSchema = z
  .object({
    id: z.string().uuid("ID pengguna harus berupa UUID."),
  })
  .strict();

export const listUsersQuerySchema = paginationQuerySchema
  .extend({
    role: userRoleZodEnum.optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return undefined;
      }),
    q: z.string().optional(),
    sortBy: z.enum(["fullName", "createdAt"]).default("createdAt"),
  })
  .strict();

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UpdateUserRoleBody = z.infer<typeof updateUserRoleBodySchema>;
export type UpdateUserStatusBody = z.infer<typeof updateUserStatusBodySchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
