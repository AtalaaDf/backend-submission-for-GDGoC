import { z } from "zod";
import { paginationQuerySchema } from "../../common/pagination.js";

export const divisionTypeZodEnum = z.enum(["technical", "non_technical"]);

export const divisionResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: divisionTypeZodEnum,
  createdAt: z.string().or(z.date()),
});

export const createDivisionBodySchema = z
  .object({
    name: z.string().min(1, "Nama divisi tidak boleh kosong."),
    type: divisionTypeZodEnum,
  })
  .strict();

export const updateDivisionBodySchema = z
  .object({
    name: z.string().min(1, "Nama divisi tidak boleh kosong.").optional(),
    type: divisionTypeZodEnum.optional(),
  })
  .strict()
  .refine((data) => data.name !== undefined || data.type !== undefined, {
    message: "Minimal satu field harus diisi untuk pembaruan.",
  });

export const divisionIdParamsSchema = z
  .object({
    id: z.string().uuid("ID divisi harus berupa UUID."),
  })
  .strict();

export const listDivisionsQuerySchema = paginationQuerySchema
  .extend({
    type: divisionTypeZodEnum.optional(),
    q: z.string().optional(),
    sortBy: z.enum(["name", "createdAt"]).default("name"),
  })
  .strict();

export type CreateDivisionBody = z.infer<typeof createDivisionBodySchema>;
export type UpdateDivisionBody = z.infer<typeof updateDivisionBodySchema>;
export type DivisionIdParams = z.infer<typeof divisionIdParamsSchema>;
export type ListDivisionsQuery = z.infer<typeof listDivisionsQuerySchema>;
export type DivisionResponse = z.infer<typeof divisionResponseSchema>;
