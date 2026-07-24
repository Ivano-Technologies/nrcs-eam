/**
 * Print md5 hashes of the four bootstrap-managed public functions.
 * Used by CI to prove a second `pnpm db:bootstrap` does not alter bodies.
 */
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const FUNCS = [
  "nrcs_item_category_code",
  "sync_delete_auth_user",
  "sync_delete_app_user",
  "rls_auto_enable",
] as const;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(url, { prepare: false, max: 1 });

async function main() {
  const rows = await client`
    SELECT p.proname AS name, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ${client(FUNCS)}
    ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
  `;

  const byName = new Map(rows.map((r) => [String(r.name), String(r.def)]));
  for (const name of FUNCS) {
    const def = byName.get(name);
    if (!def) {
      console.error(`Missing function public.${name}`);
      process.exit(1);
    }
    const hash = createHash("md5").update(def).digest("hex");
    console.log(`${name} ${hash}`);
  }

  await client.end({ timeout: 5 });
}

main().catch(async (error) => {
  console.error(error);
  try {
    await client.end({ timeout: 5 });
  } catch {
    // ignore
  }
  process.exit(1);
});
