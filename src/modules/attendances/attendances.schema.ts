import { z } from "zod";
import { paginationQuerySchema } from "../../common/pagination.js";
import { registeredMemberDetailSchema } from "../registrations/registrations.schema.js";

export const recordAttendanceBodySchema = z
  .object({
    memberId: z.string().uuid("memberId harus berupa UUID."),
  })
  .strict();

export const attendanceParamsSchema = z
  .object({
    eventId: z.string().uuid("eventId harus berupa UUID."),
  })
  .strict();

export const attendanceResponseSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  memberId: z.string().uuid(),
  checkedInAt: z.string().or(z.date()),
  recordedBy: z.string().uuid(),
  createdAt: z.string().or(z.date()),
});

export const attendanceWithMemberResponseSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  memberId: z.string().uuid(),
  checkedInAt: z.string().or(z.date()),
  recordedBy: z.string().uuid(),
  createdAt: z.string().or(z.date()),
  member: registeredMemberDetailSchema,
});

export const listAttendancesQuerySchema = paginationQuerySchema
  .extend({
    sortBy: z.enum(["checkedInAt", "memberName"]).default("checkedInAt"),
  })
  .strict();

export type RecordAttendanceBody = z.infer<typeof recordAttendanceBodySchema>;
export type AttendanceParams = z.infer<typeof attendanceParamsSchema>;
export type ListAttendancesQuery = z.infer<typeof listAttendancesQuerySchema>;
export type AttendanceResponse = z.infer<typeof attendanceResponseSchema>;
export type AttendanceWithMemberResponse = z.infer<typeof attendanceWithMemberResponseSchema>;
