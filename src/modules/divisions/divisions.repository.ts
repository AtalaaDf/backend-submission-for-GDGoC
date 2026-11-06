import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";
import { calculateOffset, escapeLikeString } from "../../common/pagination.js";
import { db } from "../../db/client.js";
import { divisions, members } from "../../db/schema.js";
import { ListDivisionsQuery } from "./divisions.schema.js";

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export const divisionsRepository = {
  async findMany(query: ListDivisionsQuery) {
    const conditions = [];

    if (query.type) {
      conditions.push(eq(divisions.type, query.type));
    }

    if (query.q) {
      const escaped = escapeLikeString(query.q);
      conditions.push(ilike(divisions.name, `%${escaped}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await db.select({ count: count() }).from(divisions).where(whereClause);

    const total = Number(totalResult[0]?.count ?? 0);
    const offset = calculateOffset(query.page, query.limit);

    const sortColumn = query.sortBy === "createdAt" ? divisions.createdAt : divisions.name;
    const sortOrder = query.order === "desc" ? desc(sortColumn) : asc(sortColumn);

    const data = await db
      .select()
      .from(divisions)
      .where(whereClause)
      .orderBy(sortOrder)
      .limit(query.limit)
      .offset(offset);

    return { data, total };
  },

  async findById(id: string, executor: DbExecutor = db) {
    const result = await executor.select().from(divisions).where(eq(divisions.id, id)).limit(1);

    return result[0] ?? null;
  },

  async findByName(name: string, executor: DbExecutor = db) {
    const result = await executor
      .select()
      .from(divisions)
      .where(sql`lower(${divisions.name}) = lower(${name})`)
      .limit(1);

    return result[0] ?? null;
  },

  async countMembersByDivisionId(divisionId: string, executor: DbExecutor = db): Promise<number> {
    const result = await executor
      .select({ count: count() })
      .from(members)
      .where(eq(members.divisionId, divisionId));

    return Number(result[0]?.count ?? 0);
  },

  async create(
    data: { name: string; type: "technical" | "non_technical" },
    executor: DbExecutor = db
  ) {
    const result = await executor.insert(divisions).values(data).returning();

    return result[0];
  },

  async update(
    id: string,
    data: { name?: string | undefined; type?: "technical" | "non_technical" | undefined },
    executor: DbExecutor = db
  ) {
    const result = await executor
      .update(divisions)
      .set(data)
      .where(eq(divisions.id, id))
      .returning();

    return result[0] ?? null;
  },

  async delete(id: string, executor: DbExecutor = db): Promise<boolean> {
    const result = await executor
      .delete(divisions)
      .where(eq(divisions.id, id))
      .returning({ id: divisions.id });

    return result.length > 0;
  },
};
