import argon2 from "argon2";
import { sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { db, queryClient } from "./client.js";
import { divisions, members, users } from "./schema.js";

export const FORBIDDEN_EXAMPLE_PASSWORDS = new Set([
  "SuperAdminPassword123!",
  "AdminPassword123!",
  "ExecutivePassword123!",
  "ProductOwner1Password123!",
  "ProductOwner2Password123!",
]);

export interface SeedPasswords {
  superadmin: string;
  admin: string;
  executive: string;
  po1: string;
  po2: string;
}

export function resolveSeedPasswords(
  nodeEnv: string,
  envVars: {
    SEED_SUPERADMIN_PASSWORD?: string | undefined;
    SEED_ADMIN_PASSWORD?: string | undefined;
    SEED_EXECUTIVE_PASSWORD?: string | undefined;
    SEED_PO1_PASSWORD?: string | undefined;
    SEED_PO2_PASSWORD?: string | undefined;
  }
): SeedPasswords {
  const isProduction = nodeEnv === "production";

  const entries = [
    {
      key: "SEED_SUPERADMIN_PASSWORD",
      role: "superadmin" as const,
      fallback: "SuperAdminPassword123!",
    },
    {
      key: "SEED_ADMIN_PASSWORD",
      role: "admin" as const,
      fallback: "AdminPassword123!",
    },
    {
      key: "SEED_EXECUTIVE_PASSWORD",
      role: "executive" as const,
      fallback: "ExecutivePassword123!",
    },
    {
      key: "SEED_PO1_PASSWORD",
      role: "po1" as const,
      fallback: "ProductOwner1Password123!",
    },
    {
      key: "SEED_PO2_PASSWORD",
      role: "po2" as const,
      fallback: "ProductOwner2Password123!",
    },
  ];

  const resolved: Partial<SeedPasswords> = {};

  for (const { key, role, fallback } of entries) {
    const rawValue = envVars[key as keyof typeof envVars];

    if (isProduction) {
      if (!rawValue || rawValue.trim().length === 0) {
        throw new Error(
          `[SEED ERROR] Di lingkungan produksi, environment variable '${key}' wajib diisi secara eksplisit.`
        );
      }
      if (rawValue.length < 12) {
        throw new Error(
          `[SEED ERROR] Di lingkungan produksi, '${key}' harus memiliki panjang minimal 12 karakter.`
        );
      }
      if (FORBIDDEN_EXAMPLE_PASSWORDS.has(rawValue)) {
        throw new Error(
          `[SEED ERROR] Di lingkungan produksi, '${key}' tidak boleh menggunakan nilai contoh bawaan (${rawValue}).`
        );
      }
      resolved[role] = rawValue;
    } else {
      resolved[role] = rawValue || fallback;
    }
  }

  return resolved as SeedPasswords;
}

export async function seed() {
  console.log("Seeding database...");

  const passwords = resolveSeedPasswords(env.NODE_ENV, {
    SEED_SUPERADMIN_PASSWORD: env.SEED_SUPERADMIN_PASSWORD,
    SEED_ADMIN_PASSWORD: env.SEED_ADMIN_PASSWORD,
    SEED_EXECUTIVE_PASSWORD: env.SEED_EXECUTIVE_PASSWORD,
    SEED_PO1_PASSWORD: env.SEED_PO1_PASSWORD,
    SEED_PO2_PASSWORD: env.SEED_PO2_PASSWORD,
  });

  // 1. Seed users (jabatan accounts)
  const initialUsers = [
    {
      email: "superadmin@gdgoc-unsri.org",
      password: passwords.superadmin,
      fullName: "Super Admin GDGoC",
      role: "superadmin" as const,
    },
    {
      email: "admin@gdgoc-unsri.org",
      password: passwords.admin,
      fullName: "Admin GDGoC",
      role: "admin" as const,
    },
    {
      email: "executive@gdgoc-unsri.org",
      password: passwords.executive,
      fullName: "Executive Leader GDGoC",
      role: "executive" as const,
    },
    {
      email: "po1@gdgoc-unsri.org",
      password: passwords.po1,
      fullName: "Product Owner Web GDGoC",
      role: "po" as const,
    },
    {
      email: "po2@gdgoc-unsri.org",
      password: passwords.po2,
      fullName: "Product Owner Mobile GDGoC",
      role: "po" as const,
    },
  ];

  for (const user of initialUsers) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${user.email})`)
      .limit(1);

    if (existing.length === 0) {
      const passwordHash = await argon2.hash(user.password, {
        type: argon2.argon2id,
      });

      await db.insert(users).values({
        email: user.email.toLowerCase(),
        passwordHash,
        fullName: user.fullName,
        role: user.role,
        isActive: true,
      });
      console.log(`User created: ${user.email} (${user.role})`);
    } else {
      console.log(`User already exists: ${user.email}`);
    }
  }

  // 2. Seed divisions
  const initialDivisions = [
    { name: "Web Development", type: "technical" as const },
    { name: "Mobile Development", type: "technical" as const },
    { name: "Cloud & AI", type: "technical" as const },
    { name: "Public Relations", type: "non_technical" as const },
    { name: "Creative & Design", type: "non_technical" as const },
  ];

  const seededDivisions: Record<string, string> = {};

  for (const div of initialDivisions) {
    const inserted = await db
      .insert(divisions)
      .values(div)
      .onConflictDoNothing({ target: divisions.name })
      .returning({ id: divisions.id, name: divisions.name });

    if (inserted[0]) {
      seededDivisions[div.name] = inserted[0].id;
      console.log(`Division created: ${div.name}`);
    } else {
      const existing = await db
        .select({ id: divisions.id, name: divisions.name })
        .from(divisions)
        .where(sql`${divisions.name} = ${div.name}`)
        .limit(1);
      if (existing[0]) {
        seededDivisions[div.name] = existing[0].id;
      }
      console.log(`Division already exists: ${div.name}`);
    }
  }

  // 3. Seed sample members
  const webDivId = seededDivisions["Web Development"];
  const mobileDivId = seededDivisions["Mobile Development"];
  const prDivId = seededDivisions["Public Relations"];

  const initialMembers = [
    { fullName: "Budi Santoso", divisionId: webDivId },
    { fullName: "Siti Rahma", divisionId: webDivId },
    { fullName: "Ahmad Fauzan", divisionId: mobileDivId },
    { fullName: "Dewi Lestari", divisionId: prDivId },
  ];

  for (const member of initialMembers) {
    if (!member.divisionId) continue;

    const existing = await db
      .select({ id: members.id })
      .from(members)
      .where(
        sql`${members.fullName} = ${member.fullName} AND ${members.divisionId} = ${member.divisionId}`
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(members).values({
        fullName: member.fullName,
        divisionId: member.divisionId,
      });
      console.log(`Member created: ${member.fullName}`);
    } else {
      console.log(`Member already exists: ${member.fullName}`);
    }
  }

  console.log("Seeding completed successfully.");
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seed()
    .then(async () => {
      await queryClient.end();
    })
    .catch(async (err) => {
      console.error(err instanceof Error ? err.message : err);
      await queryClient.end();
      process.exit(1);
    });
}
