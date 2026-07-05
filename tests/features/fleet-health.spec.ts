import { test, expect } from "@playwright/test";

test.describe("Fleet health page", () => {
  test("manager can access fleet health page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_MANAGER_EMAIL ?? "manager@test.nrcs.org");
    await page.getByLabel(/password/i).fill(process.env.E2E_MANAGER_PASSWORD ?? "TestPass123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/app/);
    await page.goto("/app/fleet-health");
    await expect(page.getByTestId("fleet-health-page")).toBeVisible();
    await expect(page.getByTestId("fleet-kpi-book-value")).toBeVisible();
  });

  test("user role cannot access fleet health", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_USER_EMAIL ?? "user@test.nrcs.org");
    await page.getByLabel(/password/i).fill(process.env.E2E_USER_PASSWORD ?? "TestPass123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/app/);
    await page.goto("/app/fleet-health");
    await expect(page.getByText(/access restricted/i)).toBeVisible();
  });
});
