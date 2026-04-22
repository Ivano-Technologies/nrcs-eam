import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

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
      "seed-e2e failed — ensure .env.e2e exists and PostgreSQL is reachable. Run: pnpm run seed-e2e:local",
    );
  }
}

/** Retained name for compatibility; now validates seeded auth state from storageState. */
export async function loginViaMagicLink(page: Page) {
  runSeedE2E();
  await page.goto("/app");
  await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
}
