import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb } from "../db";

/**
 * Apply pending SQL migrations from ./drizzle (journal + *.sql) using drizzle-orm's
 * migrator — no drizzle-kit CLI at runtime (drizzle-kit is a devDependency and is
 * not bundled into dist/index.js).
 */
export async function runProdMigrations(): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("[migrations] Database pool not available (check DATABASE_URL)");
  }
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  console.log("[migrations] Applying migrations from", migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log("[migrations] Done");
}
