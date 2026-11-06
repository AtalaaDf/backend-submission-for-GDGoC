import { z } from "zod";
import { paginationQuerySchema } from "../../common/pagination.js";
import { memberDivisionSchema } from "../members/members.schema.js";

export const registerMemberBodySchema = z
  .object({
    memberId: z.string().uuid("memberId harus berupa UUID."),
  })
  .strict();

export const registrationParamsSchema = z
  .object({
    eventId: z.string().uuid("eventId harus berupa UUID."),
  })
  .strict();

export const cancelRegistrationParamsSchema = z
  .object({
    eventId: z.string().uuid("eventId harus berupa UUID."),
    memberId: z.string().uuid("memberId harus berupa UUID."),
  })
  .strict();

export const registrationResponseSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  memberId: z.string().uuid(),
  registeredBy: z.string().uuid(),
  createdAt: z.string().or(z.date()),
});

export const registeredMemberDetailSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  division: memberDivisionSchema,
});

export const registrationWithMemberResponseSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  memberId: z.string().uuid(),
  registeredBy: z.string().uuid(),
  createdAt: z.string().or(z.date()),
  member: registeredMemberDetailSchema,
});

export const listRegistrationsQuerySchema = paginationQuerySchema
  .extend({
    q: z.string().optional(),
    sortBy: z.enum(["createdAt", "memberName"]).default("createdAt"),
  })
  .strict();

export type RegisterMemberBody = z.infer<typeof registerMemberBodySchema>;
export type RegistrationParams = z.infer<typeof registrationParamsSchema>;
export type CancelRegistrationParams = z.infer<typeof cancelRegistrationParamsSchema>;
export type ListRegistrationsQuery = z.infer<typeof listRegistrationsQuerySchema>;
export type RegistrationResponse = z.infer<typeof registrationResponseSchema>;
export type RegistrationWithMemberResponse = z.infer<typeof registrationWithMemberResponseSchema>;
