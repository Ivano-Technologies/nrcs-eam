import fs from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./live-helpers";

const authFile = path.join("playwright", ".auth", "live-auth-user.json");

setup("bootstrap live-auth storage state", async ({ page, context }) => {
  await page.goto("/login");

  const emailInput = page.getByTestId("login-email-input");
  const passwordInput = page.getByTestId("login-password-input");

  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  await passwordInput.fill(E2E_USER_PASSWORD);
  await emailInput.fill(E2E_USER_EMAIL);
  await page.getByTestId("login-password-submit").click();

  await expect(page).toHaveURL(/\/app/, { timeout: 90_000 });
  await expect(page.getByTestId("sidebar-nav-dashboard")).toBeVisible({
    timeout: 60_000,
  });

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await context.storageState({ path: authFile });
});
