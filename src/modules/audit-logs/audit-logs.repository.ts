import { and, asc, count, desc, eq, gte, lte } from "drizzle-orm";
import { calculateOffset } from "../../common/pagination.js";
import { db } from "../../db/client.js";
import { auditLogs } from "../../db/schema.js";
import { ListAuditLogsQuery } from "./audit-logs.schema.js";

export const auditLogsRepository = {
  async findMany(query: ListAuditLogsQuery) {
    const conditions = [];

    if (query.action) {
      conditions.push(eq(auditLogs.action, query.action));
    }

    if (query.entity) {
      conditions.push(eq(auditLogs.entity, query.entity));
    }

    if (query.actorId) {
      conditions.push(eq(auditLogs.actorId, query.actorId));
    }

    if (query.from) {
      conditions.push(gte(auditLogs.createdAt, new Date(query.from)));
    }

    if (query.to) {
      conditions.push(lte(auditLogs.createdAt, new Date(query.to)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await db.select({ count: count() }).from(auditLogs).where(whereClause);

    const total = Number(totalResult[0]?.count ?? 0);
    const offset = calculateOffset(query.page, query.limit);
    const sortOrder = query.order === "asc" ? asc(auditLogs.createdAt) : desc(auditLogs.createdAt);

    const data = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(sortOrder)
      .limit(query.limit)
      .offset(offset);

    return {
      data: data.map((item) => ({
        ...item,
        before: (item.before as Record<string, unknown> | null) ?? null,
        after: (item.after as Record<string, unknown> | null) ?? null,
      })),
      total,
    };
  },
};
