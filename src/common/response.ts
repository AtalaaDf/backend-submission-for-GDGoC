import { z, ZodTypeAny } from "zod";

export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export function createSuccessResponseSchema<T extends ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
  });
}

export function createPaginatedResponseSchema<T extends ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: paginationMetaSchema,
  });
}

export const errorDetailsItemSchema = z.object({
  field: z.string().optional(),
  message: z.string(),
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(errorDetailsItemSchema).nullable().optional(),
    requestId: z.string(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export function createSuccessResponse<T>(data: T, meta?: PaginationMeta) {
  if (meta) {
    return { data, meta };
  }
  return { data };
}

export function createErrorResponse(
  code: string,
  message: string,
  requestId: string,
  details: Array<{ field?: string | undefined; message: string }> | null = null
): ErrorResponse {
  return {
    error: {
      code,
      message,
      details,
      requestId,
    },
  };
}
