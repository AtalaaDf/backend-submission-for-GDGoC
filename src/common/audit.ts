import { db } from "../db/client.js";
import { auditLogs, NewAuditLog } from "../db/schema.js";

export type AuditLogParams = {
  actorId: string | null;
  actorRole: "superadmin" | "admin" | "executive" | "po";
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId: string;
};

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function recordAuditLog(
  params: AuditLogParams,
  executor: DbTransaction | typeof db = db
): Promise<void> {
  const newLog: NewAuditLog = {
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    before: params.before ?? null,
    after: params.after ?? null,
    requestId: params.requestId,
  };

  await executor.insert(auditLogs).values(newLog);
}

