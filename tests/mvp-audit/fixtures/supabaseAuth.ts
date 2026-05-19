import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient, type User } from "@supabase/supabase-js";
import type { BrowserContext, Page } from "@playwright/test";
import {
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
} from "../../../shared/const";
import { E2E_USER_EMAIL } from "../../auth/live-helpers";
import { testUser } from "./testUser";
import { applySupabaseTestSchema } from "../../helpers/testSchema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..", "..");
dotenv.config({ path: path.join(ROOT, ".env.e2e") });

type SessionPayload = {
  access_token: string;
  refresh_token: string;
  user: User;
};
const MAX_ATTEMPTS = 4;
const INITIAL_DELAY_MS = 500;

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

function isStrongPassword(value: string): boolean {
  return (
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function getSupabaseUrl() {
  return requireEnv("SUPABASE_URL");
}

function getSupabasePublishableKey() {
  return requireEnv("SUPABASE_PUBLISHABLE_KEY");
}

function getSupabaseSecretKey() {
  return requireEnv("SUPABASE_SECRET_KEY");
}

function getE2EPassword() {
  const fromEnv =
    process.env.E2E_USER_PASSWORD?.trim() ??
    process.env.TEST_USER_PASSWORD?.trim();
  const password =
    fromEnv && isStrongPassword(fromEnv) ? fromEnv : "PlaywrightTest@2026";
  if (!password) {
    throw new Error("Missing required env var: E2E_USER_PASSWORD (or TEST_USER_PASSWORD)");
  }
  return password;
}

function getE2EEmail() {
  return E2E_USER_EMAIL;
}

function createAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createPublishableClient() {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withSeedRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) {
        const reason = lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
        throw new Error(`[seed] failed after 4 attempts — Supabase may be unavailable.${reason}`);
      }
      const delay = INITIAL_DELAY_MS * 2 ** (attempt - 1);
      console.warn(`[seed] retry ${attempt + 1}/${MAX_ATTEMPTS} after ${delay}ms`);
      await sleep(delay);
    }
  }
  throw new Error("[seed] failed after 4 attempts — Supabase may be unavailable");
}

export async function createTestUserInSupabase(): Promise<User> {
  const admin = createAdminClient();
  await applySupabaseTestSchema(admin, "mvp-audit auth");
  const password = getE2EPassword();
  const email = getE2EEmail();

  let createdUser: User | null = null;
  await withSeedRetry(async () => {
    try {
      const { data, error } = await admin.auth.admin.createUser({
        email,
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
  });

  let user = createdUser;
  if (!user) {
    const listed = await withSeedRetry(async () => {
      const { data, error } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (error) {
        throw new Error(`[e2e auth] listUsers failed: ${error.message}`);
      }
      return data;
    });
    user = listed.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase()) ?? null;
  }
  if (!user?.id) {
    throw new Error("[e2e auth] test user not found after create/list");
  }

  const updated = await withSeedRetry(async () => {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: testUser.name },
    });
    if (error) {
      throw new Error(`[e2e auth] updateUserById failed: ${error.message}`);
    }
    return data;
  });
  if (!updated.user) {
    throw new Error("[e2e auth] updateUserById returned no user");
  }
  return updated.user;
}

export async function generateSessionForTestUser(): Promise<SessionPayload> {
  const password = getE2EPassword();
  const email = getE2EEmail();
  const publishable = createPublishableClient();
  await applySupabaseTestSchema(publishable, "mvp-audit auth");
  const data = await withSeedRetry(async () => {
    const { data, error } = await publishable.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session || !data.user) {
      throw new Error(`[e2e auth] signInWithPassword failed: ${error?.message ?? "no session"}`);
    }
    return data;
  });
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user,
  };
}

export async function signInTestUser(page: Page): Promise<void> {
  const session = await generateSessionForTestUser();
  await injectSessionIntoContext(page.context(), session, "http://127.0.0.1:3000");
  await page.goto("/app");
  await page.waitForURL(/\/app(\/|$)/, { timeout: 60_000 });
  // Narrow sidebar hides user name on the trigger, so getByRole(..., /E2E Admin/) is flaky.
  await page.getByTestId("sidebar-nav-dashboard").waitFor({ state: "visible", timeout: 60_000 });
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
