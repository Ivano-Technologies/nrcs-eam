import fs from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";
import { ensureE2eAuthUser } from "./ensureE2eAuthUser";
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./live-helpers";

const authFile = path.join("playwright", ".auth", "live-auth-user.json");

setup("bootstrap live-auth storage state", async ({ page, context }) => {
  await ensureE2eAuthUser();
  console.log("[auth.setup] ensured live-auth user");
  await page.goto("/login");
  console.log("[auth.setup] opened /login");

  const emailInput = page
    .getByTestId("login-email-input")
    .or(page.getByLabel(/email/i))
    .or(page.locator("input[type='email']"));
  const passwordInput = page
    .getByTestId("login-password-input")
    .or(page.getByLabel(/password/i))
    .or(page.locator("input[type='password']"));
  const submitButton = page
    .getByTestId("login-password-submit")
    .or(page.getByRole("button", { name: /sign in|login|log in|continue/i }));

  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  console.log("[auth.setup] email input visible");
  await emailInput.fill(E2E_USER_EMAIL);
  console.log("[auth.setup] email filled");
  await passwordInput.fill(E2E_USER_PASSWORD);
  console.log("[auth.setup] password filled");
  await submitButton.click();
  console.log("[auth.setup] submit clicked");

  await expect(page).toHaveURL(/\/app/, { timeout: 60_000 });
  await expect(page.getByTestId("sidebar-nav-dashboard")).toBeVisible({
    timeout: 60_000,
  });

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await context.storageState({ path: authFile });
});
