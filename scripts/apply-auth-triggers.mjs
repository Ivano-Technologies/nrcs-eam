/**
 * Apply auth ↔ app user sync triggers (scripts/setup-auth-triggers.sql).
 * Usage: node scripts/apply-auth-triggers.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

config({ path: resolve(root, ".env.local") });
config({ path: resolve(root, ".env") });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("[apply-auth-triggers] DATABASE_URL is required in .env.local");
  process.exit(1);
}

const sqlPath = resolve(__dirname, "setup-auth-triggers.sql");
const script = await readFile(sqlPath, "utf8");

const client = postgres(databaseUrl, { max: 1, ssl: databaseUrl.includes("supabase") ? "require" : undefined });

try {
  console.log("[apply-auth-triggers] Applying triggers from setup-auth-triggers.sql …");
  await client.unsafe(script);
  console.log("[apply-auth-triggers] Success — triggers on_auth_user_deleted and on_app_user_deleted are active.");
} catch (err) {
  console.error("[apply-auth-triggers] Failed:", err);
  process.exit(1);
} finally {
  await client.end();
}
