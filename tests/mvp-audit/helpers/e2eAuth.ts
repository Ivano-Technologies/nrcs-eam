import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { testUser } from "../fixtures/testUser";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export function runSeedE2E() {
  try {
    execSync("pnpm run seed-e2e:local", {
      cwd: ROOT,
      stdio: "pipe",
      encoding: "utf-8",
    });
  } catch {
    throw new Error(
      "seed-e2e failed — ensure .env.e2e exists, MySQL is running, and DATABASE_URL targets local E2E DB. Run: pnpm run seed-e2e:local",
    );
  }
}

/** Fresh token + magic-link login (single-use token; call before each authenticated test). */
export async function loginViaMagicLink(page: Page) {
  runSeedE2E();
  await page.goto(`/auth/verify?token=${testUser.magicToken}`);
  await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
}
