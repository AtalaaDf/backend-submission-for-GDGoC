import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import { calculateOffset, escapeLikeString } from "../../common/pagination.js";
import { db } from "../../db/client.js";
import { divisions, members } from "../../db/schema.js";
import { ListMembersQuery } from "./members.schema.js";

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export const membersRepository = {
  async findMany(query: ListMembersQuery, allowDeleted = false) {
    const conditions = [];

    if (!allowDeleted) {
      conditions.push(isNull(members.deletedAt));
    }

    if (query.divisionId) {
      conditions.push(eq(members.divisionId, query.divisionId));
    }

    if (query.divisionType) {
      conditions.push(eq(divisions.type, query.divisionType));
    }

    if (query.q) {
      const escaped = escapeLikeString(query.q);
      conditions.push(ilike(members.fullName, `%${escaped}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await db
      .select({ count: count() })
      .from(members)
      .innerJoin(divisions, eq(members.divisionId, divisions.id))
      .where(whereClause);

    const total = Number(totalResult[0]?.count ?? 0);
    const offset = calculateOffset(query.page, query.limit);

    const sortColumn = query.sortBy === "createdAt" ? members.createdAt : members.fullName;
    const sortOrder = query.order === "desc" ? desc(sortColumn) : asc(sortColumn);

    const rows = await db
      .select({
        id: members.id,
        fullName: members.fullName,
        deletedAt: members.deletedAt,
        createdAt: members.createdAt,
        updatedAt: members.updatedAt,
        division: {
          id: divisions.id,
          name: divisions.name,
          type: divisions.type,
        },
      })
      .from(members)
      .innerJoin(divisions, eq(members.divisionId, divisions.id))
      .where(whereClause)
      .orderBy(sortOrder)
      .limit(query.limit)
      .offset(offset);

    return { data: rows, total };
  },

  async findById(id: string, executor: DbExecutor = db) {
    const rows = await executor
      .select({
        id: members.id,
        fullName: members.fullName,
        deletedAt: members.deletedAt,
        createdAt: members.createdAt,
        updatedAt: members.updatedAt,
        division: {
          id: divisions.id,
          name: divisions.name,
          type: divisions.type,
        },
      })
      .from(members)
      .innerJoin(divisions, eq(members.divisionId, divisions.id))
      .where(eq(members.id, id))
      .limit(1);

    return rows[0] ?? null;
  },

  async create(data: { fullName: string; divisionId: string }, executor: DbExecutor = db) {
    const result = await executor
      .insert(members)
      .values({
        fullName: data.fullName.trim(),
        divisionId: data.divisionId,
      })
      .returning();

    return result[0];
  },

  async update(
    id: string,
    data: { fullName?: string | undefined; divisionId?: string | undefined },
    executor: DbExecutor = db
  ) {
    const result = await executor
      .update(members)
      .set({
        fullName: data.fullName ? data.fullName.trim() : undefined,
        divisionId: data.divisionId,
        updatedAt: new Date(),
      })
      .where(eq(members.id, id))
      .returning();

    return result[0] ?? null;
  },

  async softDelete(id: string, executor: DbExecutor = db) {
    const result = await executor
      .update(members)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(members.id, id))
      .returning();

    return result[0] ?? null;
  },

  async restore(id: string, executor: DbExecutor = db) {
    const result = await executor
      .update(members)
      .set({
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(members.id, id))
      .returning();

    return result[0] ?? null;
  },
};
