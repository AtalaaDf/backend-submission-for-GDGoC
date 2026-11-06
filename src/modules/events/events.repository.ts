import { and, asc, count, desc, eq, gte, ilike, isNull, lte, sql } from "drizzle-orm";
import { calculateOffset, escapeLikeString } from "../../common/pagination.js";
import { db } from "../../db/client.js";
import { attendances, eventRegistrations, events } from "../../db/schema.js";
import { ListEventsQuery } from "./events.schema.js";

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export const eventsRepository = {
  async findMany(query: ListEventsQuery, currentUserId?: string) {
    const conditions = [isNull(events.deletedAt)];

    if (query.mine && currentUserId) {
      conditions.push(eq(events.createdBy, currentUserId));
    }

    if (query.type) {
      conditions.push(eq(events.type, query.type));
    }

    if (query.from) {
      conditions.push(gte(events.startAt, new Date(query.from)));
    }

    if (query.to) {
      conditions.push(lte(events.startAt, new Date(query.to)));
    }

    if (query.q) {
      const escaped = escapeLikeString(query.q);
      conditions.push(ilike(events.name, `%${escaped}%`));
    }

    const whereClause = and(...conditions);

    const totalResult = await db.select({ count: count() }).from(events).where(whereClause);

    const total = Number(totalResult[0]?.count ?? 0);
    const offset = calculateOffset(query.page, query.limit);

    const sortColumn =
      query.sortBy === "name"
        ? events.name
        : query.sortBy === "createdAt"
          ? events.createdAt
          : events.startAt;

    const sortOrder = query.order === "desc" ? desc(sortColumn) : asc(sortColumn);

    const regCountSubquery = sql<number>`coalesce((select count(*) from ${eventRegistrations} where ${eventRegistrations.eventId} = ${events.id}), 0)::int`;

    const rows = await db
      .select({
        id: events.id,
        name: events.name,
        description: events.description,
        type: events.type,
        startAt: events.startAt,
        endAt: events.endAt,
        quota: events.quota,
        registeredCount: regCountSubquery,
        createdBy: events.createdBy,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .where(whereClause)
      .orderBy(sortOrder)
      .limit(query.limit)
      .offset(offset);

    const data = rows.map((row) => ({
      ...row,
      remainingQuota: Math.max(0, row.quota - row.registeredCount),
    }));

    return { data, total };
  },

  async findById(id: string, executor: DbExecutor = db) {
    const regCountSubquery = sql<number>`coalesce((select count(*) from ${eventRegistrations} where ${eventRegistrations.eventId} = ${events.id}), 0)::int`;

    const rows = await executor
      .select({
        id: events.id,
        name: events.name,
        description: events.description,
        type: events.type,
        startAt: events.startAt,
        endAt: events.endAt,
        quota: events.quota,
        registeredCount: regCountSubquery,
        createdBy: events.createdBy,
        deletedAt: events.deletedAt,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .where(and(eq(events.id, id), isNull(events.deletedAt)))
      .limit(1);

    const item = rows[0];
    if (!item) return null;

    return {
      ...item,
      remainingQuota: Math.max(0, item.quota - item.registeredCount),
    };
  },

  async findByIdRaw(id: string, executor: DbExecutor = db) {
    const rows = await executor.select().from(events).where(eq(events.id, id)).limit(1);

    return rows[0] ?? null;
  },

  async countAttendances(eventId: string, executor: DbExecutor = db): Promise<number> {
    const result = await executor
      .select({ count: count() })
      .from(attendances)
      .where(eq(attendances.eventId, eventId));

    return Number(result[0]?.count ?? 0);
  },

  async countRegistrations(eventId: string, executor: DbExecutor = db): Promise<number> {
    const result = await executor
      .select({ count: count() })
      .from(eventRegistrations)
      .where(eq(eventRegistrations.eventId, eventId));

    return Number(result[0]?.count ?? 0);
  },

  async create(
    data: {
      name: string;
      description?: string | undefined;
      type: "online" | "offline";
      startAt: Date;
      endAt: Date;
      quota: number;
      createdBy: string;
    },
    executor: DbExecutor = db
  ) {
    const result = await executor.insert(events).values(data).returning();

    return result[0];
  },

  async update(
    id: string,
    data: {
      name?: string | undefined;
      description?: string | undefined;
      type?: ("online" | "offline") | undefined;
      startAt?: Date | undefined;
      endAt?: Date | undefined;
      quota?: number | undefined;
    },
    executor: DbExecutor = db
  ) {
    const result = await executor
      .update(events)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id))
      .returning();

    return result[0] ?? null;
  },

  async softDelete(id: string, executor: DbExecutor = db) {
    const result = await executor
      .update(events)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(events.id, id))
      .returning();

    return result[0] ?? null;
  },
};
