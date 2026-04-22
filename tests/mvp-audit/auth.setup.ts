import fs from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";
import {
  generateSessionForTestUser,
  injectSessionIntoContext,
} from "./fixtures/supabaseAuth";
import { runSeedE2E } from "./helpers/e2eAuth";

const authFile = path.join("playwright", ".auth", "mvp-audit-user.json");

setup("bootstrap mvp-audit auth storage state", async ({ browser, baseURL }) => {
  runSeedE2E();
  const session = await generateSessionForTestUser();
  const context = await browser.newContext({ storageState: undefined });
  await injectSessionIntoContext(context, session, baseURL ?? "http://127.0.0.1:3000");

  const page = await context.newPage();
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await expect(page.getByRole("button", { name: /E2E Admin/i })).toBeVisible({
    timeout: 20_000,
  });

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await context.storageState({ path: authFile });
  await context.close();
});
