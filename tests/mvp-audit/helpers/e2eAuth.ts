import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { signInTestUser } from "../fixtures/supabaseAuth";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const MAX_ATTEMPTS = 4;
const INITIAL_DELAY_MS = 500;

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function runSeedE2E() {
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
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
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          `[seed] failed after 4 attempts — Supabase may be unavailable. Last error: ${lastError}`,
        );
      }
      const delay = INITIAL_DELAY_MS * 2 ** (attempt - 1);
      console.warn(`[seed] retry ${attempt + 1}/${MAX_ATTEMPTS} after ${delay}ms`);
      sleepSync(delay);
    }
  }
}

/** Signs in with Supabase email+password via the seeded E2E test user. */
export async function loginViaPassword(page: Page) {
  await signInTestUser(page);
}
