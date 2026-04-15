/**
 * Set a user's password in Supabase Auth (not in Drizzle).
 * Usage: SET_PASSWORD_EMAIL=x@y.com SET_PASSWORD_PASSWORD='...' pnpm exec tsx scripts/setPassword.ts
 * Requires: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import * as dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../drizzle/schema";

async function main() {
  const email = process.env.SET_PASSWORD_EMAIL?.trim();
  const password = process.env.SET_PASSWORD_PASSWORD;
  if (!email || !password) {
    console.error("Set SET_PASSWORD_EMAIL and SET_PASSWORD_PASSWORD");
    process.exit(1);
  }
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL!, {
    ssl: { rejectUnauthorized: false },
  });
  const db = drizzle(client);
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const u = rows[0];
  if (!u?.authUserId) {
    console.error("No app user with that email, or auth_user_id is not set");
    await client.end({ timeout: 5 });
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.admin.updateUserById(u.authUserId, {
    password,
  });
  if (error) {
    console.error(error.message);
    await client.end({ timeout: 5 });
    process.exit(1);
  }
  console.log("Password updated in Supabase Auth for", email);
  await client.end({ timeout: 5 });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
