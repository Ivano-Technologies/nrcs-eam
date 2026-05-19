import fs from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";
import { ensureE2eAuthUser } from "./ensureE2eAuthUser";
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./live-helpers";

const authFile = path.join("playwright", ".auth", "live-auth-user.json");

setup.setTimeout(600_000);

setup("bootstrap live-auth storage state", async ({ page, context }) => {
    await ensureE2eAuthUser();
    console.log("[auth.setup] ensured live-auth user");
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 180_000 });
    console.log("[auth.setup] opened /login");

    const emailInput = page.getByTestId("login-email-input");
    const passwordInput = page.getByTestId("login-password-input");
    const submitButton = page.getByTestId("login-password-submit");

    await expect(emailInput).toBeVisible({ timeout: 30_000 });
    console.log("[auth.setup] email input visible");
    await emailInput.fill(E2E_USER_EMAIL);
    console.log("[auth.setup] email filled");
    await passwordInput.fill(E2E_USER_PASSWORD);
    console.log("[auth.setup] password filled");
    await submitButton.click();
    console.log("[auth.setup] submit clicked");

    await expect(page).toHaveURL(/\/app/, { timeout: 90_000 });
    await expect(page.getByTestId("app-page-main")).toBeVisible({ timeout: 90_000 });

    fs.mkdirSync(path.dirname(authFile), { recursive: true });
    await context.storageState({ path: authFile });
});
