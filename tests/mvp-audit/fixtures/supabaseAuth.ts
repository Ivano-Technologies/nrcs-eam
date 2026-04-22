import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient, type User } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";
import {
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
} from "../../../shared/const";
import { testUser } from "./testUser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..", "..");
dotenv.config({ path: path.join(ROOT, ".env.e2e") });

type SessionPayload = {
  access_token: string;
  refresh_token: string;
  user: User;
};

type MagicLinkPayload = {
  actionLink: string;
  hashedToken: string;
  emailOtp: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function isDuplicateSupabaseUserError(message: string | undefined): boolean {
  if (!message) return false;
  return /already exists|duplicate|already been registered/i.test(message);
}

function getSupabaseUrl() {
  return requireEnv("SUPABASE_URL");
}

function getSupabaseAnonKey() {
  return requireEnv("SUPABASE_ANON_KEY");
}

function getSupabaseServiceRoleKey() {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function getE2EPassword() {
  return process.env.E2E_SUPABASE_PASSWORD?.trim() || "E2E_Supabase_ChangeMe_9!";
}

function createAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createAnonClient() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createTestUserInSupabase(): Promise<User> {
  const admin = createAdminClient();
  const password = getE2EPassword();

  let createdUser: User | null = null;
  try {
    const { data, error } = await admin.auth.admin.createUser({
      email: testUser.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: testUser.name },
    });
    if (error && !isDuplicateSupabaseUserError(error.message)) {
      throw new Error(`[e2e auth] createUser failed: ${error.message}`);
    }
    createdUser = data.user;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isDuplicateSupabaseUserError(message)) {
      throw error;
    }
  }

  if (createdUser) {
    return createdUser;
  }

  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    throw new Error(`[e2e auth] listUsers failed: ${listErr.message}`);
  }
  const existing = listed.users.find(
    (u) => (u.email ?? "").toLowerCase() === testUser.email.toLowerCase(),
  );
  if (!existing) {
    throw new Error("[e2e auth] test user not found after create/list");
  }
  return existing;
}

export async function generateSessionForTestUser(): Promise<SessionPayload> {
  await createTestUserInSupabase();
  const password = getE2EPassword();
  const anon = createAnonClient();
  const { data, error } = await anon.auth.signInWithPassword({
    email: testUser.email,
    password,
  });
  if (error || !data.session || !data.user) {
    throw new Error(`[e2e auth] signInWithPassword failed: ${error?.message ?? "no session"}`);
  }
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user,
  };
}

export async function generateMagicLinkForTestUser(): Promise<MagicLinkPayload> {
  await createTestUserInSupabase();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: testUser.email,
  });
  if (error || !data.properties) {
    throw new Error(`[e2e auth] generateLink failed: ${error?.message ?? "no properties"}`);
  }
  const actionLink = data.properties.action_link ?? "";
  const hashedToken = data.properties.hashed_token ?? "";
  if (!actionLink || !hashedToken) {
    throw new Error("[e2e auth] generateLink missing action_link or hashed_token");
  }
  return {
    actionLink,
    hashedToken,
    emailOtp: data.properties.email_otp ?? null,
  };
}

export async function injectSessionIntoContext(
  context: BrowserContext,
  session: SessionPayload,
  appBaseUrl = "http://127.0.0.1:3000",
): Promise<void> {
  const base = new URL(appBaseUrl);
  const host = base.hostname;
  const altHosts = host === "127.0.0.1" ? ["localhost"] : host === "localhost" ? ["127.0.0.1"] : [];
  const targets = [host, ...altHosts];
  const now = Math.floor(Date.now() / 1000);

  await context.addCookies(
    targets.flatMap((domain) => [
      {
        name: SUPABASE_ACCESS_TOKEN_COOKIE,
        value: session.access_token,
        domain,
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
        expires: now + 3600,
      },
      {
        name: SUPABASE_REFRESH_TOKEN_COOKIE,
        value: session.refresh_token,
        domain,
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
        expires: now + 60 * 60 * 24 * 30,
      },
    ]),
  );
}
