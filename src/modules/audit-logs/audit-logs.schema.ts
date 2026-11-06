import { z } from "zod";
import { paginationQuerySchema } from "../../common/pagination.js";
import { userRoleZodEnum } from "../users/users.schema.js";

export const auditLogResponseSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  actorRole: userRoleZodEnum,
  action: z.string(),
  entity: z.string(),
  entityId: z.string().uuid(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  requestId: z.string(),
  createdAt: z.string().or(z.date()),
});

export const listAuditLogsQuerySchema = paginationQuerySchema
  .extend({
    action: z.string().optional(),
    entity: z.string().optional(),
    actorId: z.string().uuid("actorId harus berupa UUID.").optional(),
    from: z.string().datetime({ message: "Format tanggal 'from' harus ISO 8601." }).optional(),
    to: z.string().datetime({ message: "Format tanggal 'to' harus ISO 8601." }).optional(),
    sortBy: z.enum(["createdAt"]).default("createdAt"),
  })
  .strict();

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;

