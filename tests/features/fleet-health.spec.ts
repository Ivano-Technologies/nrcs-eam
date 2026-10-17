import { test, expect } from "@playwright/test";

test.describe("Asset health page (was Fleet health)", () => {
  test("manager can access asset health page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_MANAGER_EMAIL ?? "manager@test.nrcs.org");
    await page.getByLabel(/password/i).fill(process.env.E2E_MANAGER_PASSWORD ?? "TestPass123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/app/);
    await page.goto("/app/asset-health");
    await expect(page.getByTestId("fleet-health-page")).toBeVisible();
    await expect(page.getByTestId("fleet-kpi-book-value")).toBeVisible();
  });

  test("user role cannot access asset health", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_USER_EMAIL ?? "user@test.nrcs.org");
    await page.getByLabel(/password/i).fill(process.env.E2E_USER_PASSWORD ?? "TestPass123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/app/);
    await page.goto("/app/asset-health");
    await expect(page.getByText(/access restricted/i)).toBeVisible();
  });

  test("old /app/fleet-health link redirects to asset health", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_MANAGER_EMAIL ?? "manager@test.nrcs.org");
    await page.getByLabel(/password/i).fill(process.env.E2E_MANAGER_PASSWORD ?? "TestPass123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/app/);
    await page.goto("/app/fleet-health");
    await page.waitForURL(/\/app\/asset-health/);
    await expect(page.getByTestId("fleet-health-page")).toBeVisible();
  });
});
