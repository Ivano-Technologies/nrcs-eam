import fs from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";
import { runSeedE2E } from "./helpers/e2eAuth";
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "../auth/live-helpers";
import { setupTestSchema } from "../../scripts/db/setup-test-schema";

const authFile = path.join("playwright", ".auth", "mvp-audit-user.json");

setup("bootstrap mvp-audit auth storage state", async ({ page, context }) => {
  await setupTestSchema();
  runSeedE2E();
  await page.goto("/login");
  await expect(page.getByTestId("login-email-input")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("login-email-input").fill(E2E_USER_EMAIL);
  await page.getByTestId("login-password-input").fill(E2E_USER_PASSWORD);
  await page.getByTestId("login-password-submit").click();

  await expect(page).toHaveURL(/\/app(\/|$)/);
  await expect(page.getByRole("button", { name: /E2E Admin/i })).toBeVisible({
    timeout: 20_000,
  });

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await context.storageState({ path: authFile });
});
