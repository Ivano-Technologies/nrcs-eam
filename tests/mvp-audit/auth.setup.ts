import fs from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";
import { ensureE2eAuthUser } from "../auth/ensureE2eAuthUser";
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "../auth/live-helpers";
import { runSeedE2E } from "./helpers/e2eAuth";
import { setupTestSchema } from "../../scripts/db/setup-test-schema";

const authFile = path.join("playwright", ".auth", "mvp-audit-user.json");

// `setup(title, details)` accepts only tags/annotations, not timeout.
setup.setTimeout(600_000);

setup("bootstrap mvp-audit auth storage state", async ({ page, context }) => {
    await ensureE2eAuthUser();
    console.log("[mvp-audit/auth.setup] ensured E2E auth user");
    await setupTestSchema();
    console.log("[mvp-audit/auth.setup] test schema ready");
    runSeedE2E();
    console.log("[mvp-audit/auth.setup] seed-e2e complete");

    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 180_000 });
    console.log("[mvp-audit/auth.setup] opened /login");

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
    console.log("[mvp-audit/auth.setup] email input visible");
    await emailInput.fill(E2E_USER_EMAIL);
    console.log("[mvp-audit/auth.setup] email filled");
    await passwordInput.fill(E2E_USER_PASSWORD);
    console.log("[mvp-audit/auth.setup] password filled");
    await submitButton.click();
    console.log("[mvp-audit/auth.setup] submit clicked");

    await expect(page).toHaveURL(/\/app(\/|$)/, { timeout: 90_000 });
    // `sidebar-nav-dashboard` still exists on desktop SidebarMenuButton but the sidebar drawer is hidden
    // below the `md` breakpoint; main content shell is stable once auth hydration completes.
    await expect(page.getByTestId("app-page-main")).toBeVisible({ timeout: 90_000 });
    console.log("[mvp-audit/auth.setup] app shell visible");

    fs.mkdirSync(path.dirname(authFile), { recursive: true });
    await context.storageState({ path: authFile });
});
