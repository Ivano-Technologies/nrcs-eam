import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

/**
 * `DATABASE_URL` resolution for drizzle-kit (migrate, push, studio):
 *
 * 1. If the process already has a Postgres `DATABASE_URL` (e.g. from `dotenv -e .env -- drizzle-kit migrate`
 *    or `dotenv -e .env.e2e -- …`), **do not override it** — this is how `pnpm db:migrate:dev` vs
 *    `pnpm db:migrate:e2e` target different databases.
 * 2. Otherwise load **`.env`** first (normal local dev).
 * 3. If still missing or non-Postgres (e.g. legacy MySQL in `.env`), load **`.env.e2e`** with override
 *    so Playwright / e2e Postgres URLs can win.
 *
 * **Never** load `.env.e2e` with `override: true` when a valid Postgres URL is already set — that was
 * the previous bug (e2e always stomped dev when both files existed).
 */
if (!/^postgres(ql)?:/i.test(process.env.DATABASE_URL ?? "")) {
  dotenv.config({ path: ".env" });
}
if (!/^postgres(ql)?:/i.test(process.env.DATABASE_URL ?? "")) {
  dotenv.config({ path: ".env.e2e", override: true });
}

function getDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run drizzle commands");
  }
  return connectionString;
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});
