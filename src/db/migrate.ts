import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, queryClient } from "./client.js";

export async function runMigrations() {
  console.log("Running database migrations...");
  try {
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    console.log("Migrations applied successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  runMigrations().then(async () => {
    await queryClient.end();
  });
}

