import "dotenv/config";
import { z } from "zod";

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_EXPIRES_IN: z.string().default("1h"),
    CORS_ORIGINS: z
      .string()
      .default("http://localhost:3000")
      .transform((val) => val.split(",").map((origin) => origin.trim())),
    RATE_LIMIT_MAX: z.coerce.number().default(100),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(5),
    SEED_SUPERADMIN_PASSWORD: z.string().min(12).optional(),
    SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
    SEED_EXECUTIVE_PASSWORD: z.string().min(12).optional(),
    SEED_PO1_PASSWORD: z.string().min(12).optional(),
    SEED_PO2_PASSWORD: z.string().min(12).optional(),
  })
  .transform((data) => {
    // In development and test environments, seed passwords automatically receive safe fallbacks.
    // In production, the runtime API does NOT require any SEED_*_PASSWORD.
    if (data.NODE_ENV !== "production") {
      return {
        ...data,
        SEED_SUPERADMIN_PASSWORD: data.SEED_SUPERADMIN_PASSWORD ?? "SuperAdminPassword123!",
        SEED_ADMIN_PASSWORD: data.SEED_ADMIN_PASSWORD ?? "AdminPassword123!",
        SEED_EXECUTIVE_PASSWORD: data.SEED_EXECUTIVE_PASSWORD ?? "ExecutivePassword123!",
        SEED_PO1_PASSWORD: data.SEED_PO1_PASSWORD ?? "ProductOwner1Password123!",
        SEED_PO2_PASSWORD: data.SEED_PO2_PASSWORD ?? "ProductOwner2Password123!",
      };
    }
    return data;
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables:", parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
export type Env = z.infer<typeof envSchema>;
