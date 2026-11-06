import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { calculateOffset, escapeLikeString } from "../../common/pagination.js";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { ListUsersQuery } from "./users.schema.js";

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export const usersRepository = {
  async findMany(query: ListUsersQuery) {
    const conditions = [];

    if (query.role) {
      conditions.push(eq(users.role, query.role));
    }

    if (query.isActive !== undefined) {
      conditions.push(eq(users.isActive, query.isActive));
    }

    if (query.q) {
      const escaped = escapeLikeString(query.q);
      conditions.push(
        or(ilike(users.fullName, `%${escaped}%`), ilike(users.email, `%${escaped}%`))
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await db.select({ count: count() }).from(users).where(whereClause);

    const total = Number(totalResult[0]?.count ?? 0);
    const offset = calculateOffset(query.page, query.limit);

    const sortColumn = query.sortBy === "fullName" ? users.fullName : users.createdAt;
    const sortOrder = query.order === "asc" ? asc(sortColumn) : desc(sortColumn);

    const data = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(sortOrder)
      .limit(query.limit)
      .offset(offset);

    return { data, total };
  },

  async findById(id: string, executor: DbExecutor = db) {
    const result = await executor
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0] ?? null;
  },

  async findByEmail(email: string, executor: DbExecutor = db) {
    const result = await executor
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);

    return result[0] ?? null;
  },

  async countActiveSuperadmins(executor: DbExecutor = db): Promise<number> {
    const result = await executor
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.role, "superadmin"), eq(users.isActive, true)));

    return Number(result[0]?.count ?? 0);
  },

  async create(
    data: {
      email: string;
      passwordHash: string;
      fullName: string;
      role: "superadmin" | "admin" | "executive" | "po";
    },
    executor: DbExecutor = db
  ) {
    const result = await executor
      .insert(users)
      .values({
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        role: data.role,
        isActive: true,
      })
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return result[0];
  },

  async update(
    id: string,
    data: {
      role?: "superadmin" | "admin" | "executive" | "po";
      isActive?: boolean;
    },
    executor: DbExecutor = db
  ) {
    const result = await executor
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return result[0] ?? null;
  },
};
