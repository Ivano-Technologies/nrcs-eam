/**
 * Set a user's password in Supabase Auth (not in Drizzle).
 * Usage: SET_PASSWORD_EMAIL=x@y.com SET_PASSWORD_PASSWORD='...' pnpm exec tsx scripts/setPassword.ts
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Defaults to ivanonigeria@gmail.com / ChangeMe123! if env vars not set.
 * Also backfills auth_user_id on the app users row if missing.
 */
import * as dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../drizzle/schema";

async function main() {
  const email = (process.env.SET_PASSWORD_EMAIL ?? "ivanonigeria@gmail.com").trim();
  const password = process.env.SET_PASSWORD_PASSWORD ?? "ChangeMe123!";

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Step 1: Look up the Supabase Auth user by email
  console.log(`Looking up Supabase Auth user for ${email}...`);
  const { data: listData, error: listError } =
    await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Failed to list auth users:", listError.message);
    process.exit(1);
  }

  const authUser = listData.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  let authUserId: string;

  if (!authUser) {
    // Step 2: Create the Supabase Auth user if not found
    console.log(`Auth user not found — creating ${email} in Supabase Auth...`);
    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (createError || !created?.user) {
      console.error("Failed to create auth user:", createError?.message);
      process.exit(1);
    }
    authUserId = created.user.id;
    console.log(`✅ Auth user created with UID: ${authUserId}`);
  } else {
    authUserId = authUser.id;
    console.log(`Found auth user UID: ${authUserId}`);

    // Step 3: Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      authUserId,
      { password }
    );
    if (updateError) {
      console.error("Failed to update password:", updateError.message);
      process.exit(1);
    }
    console.log(`✅ Password updated in Supabase Auth for ${email}`);
  }

  // Step 4: Backfill auth_user_id in app users table if missing
  if (process.env.DATABASE_URL) {
    const client = postgres(process.env.DATABASE_URL, {
      ssl: { rejectUnauthorized: false },
    });
    const db = drizzle(client);

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (rows.length > 0 && !rows[0].authUserId) {
      await db
        .update(users)
        .set({ authUserId })
        .where(eq(users.email, email));
      console.log(`✅ Backfilled auth_user_id on app users row for ${email}`);
    } else if (rows.length === 0) {
      console.warn(
        `⚠️  No app users row found for ${email} — login will fail until one exists`
      );
    } else {
      console.log(`ℹ️  auth_user_id already set on app users row`);
    }

    await client.end({ timeout: 5 });
  } else {
    console.warn("⚠️  DATABASE_URL not set — skipping auth_user_id backfill");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});