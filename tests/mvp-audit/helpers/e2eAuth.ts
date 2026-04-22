import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { signInTestUser } from "../fixtures/supabaseAuth";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export function runSeedE2E() {
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      execSync("pnpm run seed-e2e:local", {
        cwd: ROOT,
        stdio: "pipe",
        encoding: "utf-8",
      });
      return;
    } catch (error) {
      if (error instanceof Error) {
        lastError = error.message;
      }
      if (attempt === 3) {
        throw new Error(
          "seed-e2e failed after 3 attempts — ensure .env.e2e exists and PostgreSQL is reachable. " +
            `Last error: ${lastError}`,
        );
      }
    }
  }
}

/** Retained name for compatibility; now signs in with Supabase email+password. */
export async function loginViaMagicLink(page: Page) {
  await signInTestUser(page);
}
