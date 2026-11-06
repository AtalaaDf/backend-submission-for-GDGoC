import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";

export const authRepository = {
  async findByEmailForAuth(email: string) {
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);

    return result[0] ?? null;
  },

  async findById(id: string) {
    const result = await db
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
};

