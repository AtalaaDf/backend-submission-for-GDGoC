import { z } from "zod";

export const healthResponseSchema = z.object({
  data: z.object({
    status: z.string(),
    timestamp: z.string(),
  }),
});

export const readyResponseSchema = z.object({
  data: z.object({
    status: z.string(),
    database: z.string(),
    timestamp: z.string(),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadyResponse = z.infer<typeof readyResponseSchema>;

