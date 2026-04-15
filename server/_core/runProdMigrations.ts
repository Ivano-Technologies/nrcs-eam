import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb, resetDbConnection } from "../db";

/** Full text of an error and its `.cause` chain (Drizzle wraps TLS/network errors in `cause`). */
function errorChainText(err: unknown): string {
  const parts: string[] = [];
  let e: unknown = err;
  for (let depth = 0; depth < 12 && e != null; depth++) {
    if (e instanceof Error) {
      parts.push(e.message, e.stack ?? "");
      e = (e as Error & { cause?: unknown }).cause;
    } else {
      parts.push(String(e));
      break;
    }
  }
  return parts.join("\n");
}

function isTransientMigrationError(err: unknown): boolean {
  const text = errorChainText(err);
  return /ECONNRESET|ETIMEDOUT|EPIPE|ENOTFOUND|socket disconnected|wrong version number|TLS|SSL|timeout|refused|ERR_SSL|ECONNREFUSED/i.test(
    text
  );
}

/**
 * Apply pending SQL migrations from ./drizzle (journal + *.sql) using drizzle-orm's
 * migrator — no drizzle-kit CLI at runtime (drizzle-kit is a devDependency and is
 * not bundled into dist/index.js).
 *
 * Retries on transient RDS/VPC TLS and network errors so App Runner cold starts
 * do not roll back the whole deployment when the first connection attempt fails.
 */
export async function runProdMigrations(): Promise<void> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const maxAttempts = Number(process.env.MIGRATION_MAX_ATTEMPTS ?? "8");
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const db = await getDb();
      if (!db) {
        throw new Error("[migrations] Database pool not available (check DATABASE_URL)");
      }
      console.log(
        "[migrations] Applying migrations from",
        migrationsFolder,
        `(attempt ${attempt}/${maxAttempts})`
      );
      await migrate(db, { migrationsFolder });
      console.log("[migrations] Done");
      return;
    } catch (e) {
      lastError = e;
      await resetDbConnection();
      if (!isTransientMigrationError(e) || attempt === maxAttempts) {
        throw e;
      }
      const delayMs = Math.min(2000 * attempt, 20_000);
      console.warn(
        `[migrations] Transient error on attempt ${attempt}/${maxAttempts}, retrying in ${delayMs}ms:`,
        e instanceof Error ? e.message : e
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "migration failed"));
}
