/**
 * Live E2E helpers: reuse shared test sites and clean up entities created during tests
 * so production is not left with Playwright artifacts.
 */
import { chromium, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "../auth/live-helpers";

/** Fresh browser session for `afterAll` cleanup (isolated from the test's page/context). */
export async function runLiveBrowserCleanup(
  fn: (page: Page) => Promise<void>
): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await fn(page);
  } finally {
    await browser.close();
  }
}

/** Stable name for a shared site row used when tests need a deterministic site (reuse if present). */
export const LIVE_E2E_SHARED_SITE_NAME = "E2E Playwright Shared Site";

/**
 * Returns true if a site card with this display name is visible on /app/sites.
 */
export async function siteExistsByName(page: Page, siteName: string): Promise<boolean> {
  await page.goto("/app/sites");
  await expect(page.getByRole("heading", { name: /Sites Management/i })).toBeVisible({
    timeout: 30_000,
  });
  const card = page.locator("[data-testid^='site-card-']").filter({ hasText: siteName });
  return (await card.count()) > 0;
}

/**
 * If a site with `siteName` already exists, does nothing.
 * Otherwise opens Add Site and creates one with that name (minimal required fields).
 */
export async function ensureTestSite(page: Page, siteName: string): Promise<void> {
  await page.goto("/app/sites");
  await expect(page.getByRole("heading", { name: /Sites Management/i })).toBeVisible({
    timeout: 30_000,
  });
  const existing = page.locator("[data-testid^='site-card-']").filter({ hasText: siteName });
  if ((await existing.count()) > 0) {
    return;
  }
  await page.getByRole("button", { name: /Add Site/i }).click();
  await page.getByLabel(/Site Name/i).fill(siteName);
  await page.getByRole("button", { name: /^Create Site$/i }).click();
  await expect(page.getByText(/Site created successfully/i)).toBeVisible({ timeout: 60_000 });
}

/**
 * Deletes an asset by asset tag via the Asset Register UI (admin).
 * No-ops if the row is missing or delete controls are not available.
 */
export async function deleteAssetByTagViaUi(page: Page, assetTag: string): Promise<void> {
  await loginAsAdmin(page);
  await page.goto("/app/assets");
  await expect(
    page.getByTestId("asset-register-heading").or(page.getByRole("heading", { name: /Asset Register/i }))
  ).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("asset-search-input").fill(assetTag);
  await page.waitForTimeout(400);
  const deleteBtn = page.getByTestId("asset-delete-btn").first();
  if ((await deleteBtn.count()) === 0) {
    return;
  }
  await deleteBtn.click();
  const confirm = page.getByTestId("asset-delete-confirm");
  if ((await confirm.count()) > 0) {
    await confirm.click();
    await expect(page.getByText(/Asset deleted/i)).toBeVisible({ timeout: 30_000 }).catch(() => {});
  }
}

/**
 * Sets work order status to Cancelled via detail page (no delete API on work orders).
 */
export async function cancelWorkOrderByNumberViaUi(page: Page, woNum: string): Promise<void> {
  await loginAsAdmin(page);
  await page.goto("/app/work-orders");
  await expect(page.getByRole("heading", { name: /^Work Orders$/ })).toBeVisible({ timeout: 30_000 });
  const link = page.locator(`a[href*="/app/work-orders/"]`).filter({ hasText: woNum }).first();
  if ((await link.count()) === 0) {
    return;
  }
  await link.click();
  await expect(page).toHaveURL(/\/app\/work-orders\/\d+/, { timeout: 30_000 });
  const editBtn = page.getByTestId("work-order-edit-btn");
  if ((await editBtn.count()) === 0) {
    await page.getByRole("button", { name: /^Edit$/ }).click();
  } else {
    await editBtn.click();
  }
  const statusSelect = page.getByTestId("work-order-status-select");
  if ((await statusSelect.count()) > 0) {
    await statusSelect.click();
  } else {
    await page.getByRole("dialog").getByRole("combobox").first().click();
  }
  await page.getByRole("option", { name: /^Cancelled$/i }).click();
  const updateBtn = page.getByTestId("work-order-update-btn");
  if ((await updateBtn.count()) > 0) {
    await updateBtn.click();
  } else {
    await page.getByRole("button", { name: /^Update$/ }).click();
  }
  await expect(page.getByText(/Work order updated/i)).toBeVisible({ timeout: 30_000 }).catch(() => {});
}

/**
 * Deletes a user by email from User Management (admin). No-ops if user not found.
 */
export async function deleteUserByEmailViaUi(page: Page, email: string): Promise<void> {
  await loginAsAdmin(page);
  await page.goto("/app/users");
  await expect(page.getByRole("heading", { name: /User Management/i })).toBeVisible({ timeout: 30_000 });
  const card = page.locator('[data-testid^="user-card-"]').filter({ hasText: email }).first();
  if ((await card.count()) === 0) {
    return;
  }
  const editDeleteRow = card.locator("div.flex.gap-1").first();
  if ((await editDeleteRow.getByRole("button").count()) < 2) {
    return;
  }
  await editDeleteRow.getByRole("button").nth(1).click();
  await page.getByRole("button", { name: /^Delete User$/i }).click();
  await expect(page.getByText(/deleted successfully/i)).toBeVisible({ timeout: 30_000 }).catch(() => {});
}
