import { z } from "zod";
import { paginationQuerySchema } from "../../common/pagination.js";

export const eventTypeZodEnum = z.enum(["online", "offline"]);

export const eventResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  type: eventTypeZodEnum,
  startAt: z.string().or(z.date()),
  endAt: z.string().or(z.date()),
  quota: z.number().int().positive(),
  registeredCount: z.number().int().nonnegative(),
  remainingQuota: z.number().int().nonnegative(),
  createdBy: z.string().uuid(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const createEventBodySchema = z
  .object({
    name: z.string().min(1, "Nama event tidak boleh kosong."),
    description: z.string().optional(),
    type: eventTypeZodEnum,
    startAt: z.string().datetime({ message: "Format tanggal startAt harus ISO 8601." }),
    endAt: z.string().datetime({ message: "Format tanggal endAt harus ISO 8601." }),
    quota: z.number().int().min(1, "Kuota minimal 1."),
  })
  .strict()
  .refine((data) => new Date(data.endAt).getTime() > new Date(data.startAt).getTime(), {
    message: "Jam selesai (endAt) harus setelah jam mulai (startAt).",
    path: ["endAt"],
  });

export const updateEventBodySchema = z
  .object({
    name: z.string().min(1, "Nama event tidak boleh kosong.").optional(),
    description: z.string().optional(),
    type: eventTypeZodEnum.optional(),
    startAt: z.string().datetime({ message: "Format tanggal startAt harus ISO 8601." }).optional(),
    endAt: z.string().datetime({ message: "Format tanggal endAt harus ISO 8601." }).optional(),
    quota: z.number().int().min(1, "Kuota minimal 1.").optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return new Date(data.endAt).getTime() > new Date(data.startAt).getTime();
      }
      return true;
    },
    {
      message: "Jam selesai (endAt) harus setelah jam mulai (startAt).",
      path: ["endAt"],
    }
  );

export const eventIdParamsSchema = z
  .object({
    id: z.string().uuid("ID event harus berupa UUID."),
  })
  .strict();

export const listEventsQuerySchema = paginationQuerySchema
  .extend({
    q: z.string().optional(),
    type: eventTypeZodEnum.optional(),
    from: z.string().datetime({ message: "Format tanggal 'from' harus ISO 8601." }).optional(),
    to: z.string().datetime({ message: "Format tanggal 'to' harus ISO 8601." }).optional(),
    mine: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    sortBy: z.enum(["startAt", "name", "createdAt"]).default("startAt"),
  })
  .strict();

export type CreateEventBody = z.infer<typeof createEventBodySchema>;
export type UpdateEventBody = z.infer<typeof updateEventBodySchema>;
export type EventIdParams = z.infer<typeof eventIdParamsSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type EventResponse = z.infer<typeof eventResponseSchema>;
