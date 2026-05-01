import { createClient } from "@supabase/supabase-js";
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./live-helpers";

/** Ensures the Playwright E2E user exists in Supabase Auth with confirmed email and known password. */
export async function ensureE2eAuthUser(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRole) {
    console.warn("[ensureE2eAuthUser] Skipping; SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
    return;
  }
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) {
    throw new Error(`[ensureE2eAuthUser] listUsers failed: ${listed.error.message}`);
  }
  let user = listed.data.users.find((u) => (u.email ?? "").toLowerCase() === E2E_USER_EMAIL.toLowerCase());
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: E2E_USER_EMAIL,
      password: E2E_USER_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "[TEST] E2E Admin" },
    });
    if (created.error) {
      throw new Error(`[ensureE2eAuthUser] createUser failed: ${created.error.message}`);
    }
    user = created.data.user ?? undefined;
  }
  if (!user?.id) {
    throw new Error("[ensureE2eAuthUser] Could not resolve E2E user id");
  }
  const updated = await admin.auth.admin.updateUserById(user.id, {
    password: E2E_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "[TEST] E2E Admin" },
  });
  if (updated.error) {
    throw new Error(`[ensureE2eAuthUser] updateUserById failed: ${updated.error.message}`);
  }
}
