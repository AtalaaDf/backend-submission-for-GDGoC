import { describe, expect, it } from "vitest";
import { envSchema } from "../../src/config/env.js";
import { FORBIDDEN_EXAMPLE_PASSWORDS, resolveSeedPasswords } from "../../src/db/seed.js";

describe("Seed Passwords & Production Environment Validation", () => {
  const baseValidEnv = {
    DATABASE_URL: "postgres://localhost:5432/db",
    JWT_SECRET: "super_secret_jwt_key_must_be_at_least_32_characters_long",
  };

  describe("Kasus 1: Runtime API Environment Validation (envSchema)", () => {
    it("should allow runtime API to start in production without any SEED_*_PASSWORD variables", () => {
      const prodResult = envSchema.safeParse({
        ...baseValidEnv,
        NODE_ENV: "production",
      });

      expect(prodResult.success).toBe(true);
      if (prodResult.success) {
        expect(prodResult.data.SEED_SUPERADMIN_PASSWORD).toBeUndefined();
        expect(prodResult.data.SEED_ADMIN_PASSWORD).toBeUndefined();
        expect(prodResult.data.SEED_EXECUTIVE_PASSWORD).toBeUndefined();
        expect(prodResult.data.SEED_PO1_PASSWORD).toBeUndefined();
        expect(prodResult.data.SEED_PO2_PASSWORD).toBeUndefined();
      }
    });

    it("should automatically provide default seed passwords in development when omitted", () => {
      const devResult = envSchema.safeParse({
        ...baseValidEnv,
        NODE_ENV: "development",
      });

      expect(devResult.success).toBe(true);
      if (devResult.success) {
        expect(devResult.data.SEED_SUPERADMIN_PASSWORD).toBe("SuperAdminPassword123!");
        expect(devResult.data.SEED_ADMIN_PASSWORD).toBe("AdminPassword123!");
        expect(devResult.data.SEED_EXECUTIVE_PASSWORD).toBe("ExecutivePassword123!");
        expect(devResult.data.SEED_PO1_PASSWORD).toBe("ProductOwner1Password123!");
        expect(devResult.data.SEED_PO2_PASSWORD).toBe("ProductOwner2Password123!");
      }
    });

    it("should automatically provide default seed passwords in test when omitted", () => {
      const testResult = envSchema.safeParse({
        ...baseValidEnv,
        NODE_ENV: "test",
      });

      expect(testResult.success).toBe(true);
      if (testResult.success) {
        expect(testResult.data.SEED_SUPERADMIN_PASSWORD).toBe("SuperAdminPassword123!");
      }
    });

    it("should reject any provided SEED_*_PASSWORD that has fewer than 12 characters", () => {
      const invalidResult = envSchema.safeParse({
        ...baseValidEnv,
        NODE_ENV: "production",
        SEED_SUPERADMIN_PASSWORD: "shortpassword", // 13 chars (ok)
        SEED_ADMIN_PASSWORD: "short", // 5 chars (< 12)
      });

      expect(invalidResult.success).toBe(false);
      if (!invalidResult.success) {
        expect(
          invalidResult.error.issues.some((issue) => issue.path.includes("SEED_ADMIN_PASSWORD"))
        ).toBe(true);
      }
    });
  });

  describe("Kasus 2: Seed Script Password Resolution (resolveSeedPasswords)", () => {
    const validProdPasswords = {
      SEED_SUPERADMIN_PASSWORD: "SuperAdminUniqueProdPass2026!",
      SEED_ADMIN_PASSWORD: "AdminUniqueProdPass2026!",
      SEED_EXECUTIVE_PASSWORD: "ExecutiveUniqueProdPass2026!",
      SEED_PO1_PASSWORD: "ProductOwner1UniqueProdPass2026!",
      SEED_PO2_PASSWORD: "ProductOwner2UniqueProdPass2026!",
    };

    it("should successfully resolve valid, custom, strong passwords in production", () => {
      const resolved = resolveSeedPasswords("production", validProdPasswords);

      expect(resolved.superadmin).toBe(validProdPasswords.SEED_SUPERADMIN_PASSWORD);
      expect(resolved.admin).toBe(validProdPasswords.SEED_ADMIN_PASSWORD);
      expect(resolved.executive).toBe(validProdPasswords.SEED_EXECUTIVE_PASSWORD);
      expect(resolved.po1).toBe(validProdPasswords.SEED_PO1_PASSWORD);
      expect(resolved.po2).toBe(validProdPasswords.SEED_PO2_PASSWORD);
    });

    it("should reject seed execution in production when any SEED_*_PASSWORD is missing or empty", () => {
      expect(() => {
        resolveSeedPasswords("production", {
          ...validProdPasswords,
          SEED_SUPERADMIN_PASSWORD: "",
        });
      }).toThrow(
        /Di lingkungan produksi, environment variable 'SEED_SUPERADMIN_PASSWORD' wajib diisi/
      );

      expect(() => {
        resolveSeedPasswords("production", {
          ...validProdPasswords,
          SEED_ADMIN_PASSWORD: undefined,
        });
      }).toThrow(/Di lingkungan produksi, environment variable 'SEED_ADMIN_PASSWORD' wajib diisi/);
    });

    it("should reject seed execution in production when password uses example default from .env.example", () => {
      for (const examplePassword of FORBIDDEN_EXAMPLE_PASSWORDS) {
        expect(() => {
          resolveSeedPasswords("production", {
            ...validProdPasswords,
            SEED_SUPERADMIN_PASSWORD: examplePassword,
          });
        }).toThrow(/tidak boleh menggunakan nilai contoh bawaan/);
      }
    });

    it("should reject seed execution in production when password is under 12 characters", () => {
      expect(() => {
        resolveSeedPasswords("production", {
          ...validProdPasswords,
          SEED_PO1_PASSWORD: "short123!",
        });
      }).toThrow(/harus memiliki panjang minimal 12 karakter/);
    });

    it("should allow default fallback passwords in development when not provided", () => {
      const devResolved = resolveSeedPasswords("development", {});

      expect(devResolved.superadmin).toBe("SuperAdminPassword123!");
      expect(devResolved.admin).toBe("AdminPassword123!");
      expect(devResolved.executive).toBe("ExecutivePassword123!");
      expect(devResolved.po1).toBe("ProductOwner1Password123!");
      expect(devResolved.po2).toBe("ProductOwner2Password123!");
    });

    it("should allow custom passwords in development when provided", () => {
      const devResolved = resolveSeedPasswords("development", {
        SEED_SUPERADMIN_PASSWORD: "CustomDevSuperAdminPass!",
      });

      expect(devResolved.superadmin).toBe("CustomDevSuperAdminPass!");
      expect(devResolved.admin).toBe("AdminPassword123!");
    });
  });
});
