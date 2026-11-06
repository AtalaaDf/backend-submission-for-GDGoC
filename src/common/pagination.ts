import { z } from "zod";
import { PaginationMeta } from "./response.js";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function calculatePaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
  };
}

export function escapeLikeString(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

