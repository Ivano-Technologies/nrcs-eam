/**
 * One-off: remove app user + Supabase Auth user by email.
 * Usage: pnpm exec tsx scripts/delete-user-by-email.ts user@example.com
 * Requires DATABASE_URL, SUPABASE_URL, SUPABASE_SECRET_KEY in env.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../drizzle/schema";
import { getSupabaseSecret } from "../server/_core/supabase";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: tsx scripts/delete-user-by-email.ts <email>");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const client = postgres(url, { prepare: false, max: 2, ssl: { rejectUnauthorized: false } });
  const db = drizzle(client);

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const supabase = getSupabaseSecret();

  if (rows.length > 0 && rows[0].authUserId) {
    const { error } = await supabase.auth.admin.deleteUser(rows[0].authUserId);
    if (error) console.error("Supabase deleteUser:", error.message);
    else console.log("Deleted Supabase Auth user", rows[0].authUserId);
  }

  if (rows.length > 0) {
    await db.delete(users).where(eq(users.id, rows[0].id));
    console.log("Deleted app user row id", rows[0].id);
  } else {
    console.log("No app user row for", email);
  }

  await client.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
