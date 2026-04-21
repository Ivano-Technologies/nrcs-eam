/**
 * Live E2E helpers: reuse existing production sites (read-only) and clean up entities created during tests
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

/**
 * Preferred shared label if it still exists in the DB (tests do not create this row).
 * @deprecated Use resolveLiveTestSiteName() — do not assert on this exact string in production.
 */
export const LIVE_E2E_SHARED_SITE_NAME = "E2E Playwright Shared Site";

async function gotoFacilitiesPage(page: Page): Promise<void> {
  await page.goto("/app/facilities");
  const facilitiesHeading = page.getByRole("heading", { name: /Facilities Management/i });
  if ((await facilitiesHeading.count()) > 0) {
    await expect(facilitiesHeading).toBeVisible({ timeout: 30_000 });
    return;
  }
  await page.goto("/app/sites");
  await expect(
    page
      .getByRole("heading", { name: /Facilities Management/i })
      .or(page.getByRole("heading", { name: /Sites Management/i }))
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * Returns true if a facility row with this display name is visible on /app/facilities.
 */
export async function siteExistsByName(page: Page, siteName: string): Promise<boolean> {
  await gotoFacilitiesPage(page);
  const row = page.locator("[data-testid^='facility-row-']").filter({ hasText: siteName });
  if ((await row.count()) > 0) return true;
  const card = page.locator("[data-testid^='site-card-']").filter({ hasText: siteName });
  if ((await card.count()) > 0) return true;
  const genericRow = page.locator("tbody tr").filter({ hasText: siteName });
  return (await genericRow.count()) > 0;
}

/**
 * Read-only: resolves a site name to use in asset/WO forms.
 * - If a row for {@link LIVE_E2E_SHARED_SITE_NAME} exists, returns that name.
 * - Otherwise returns the display name of the first facility row.
 * Does **not** create, update, or delete sites.
 */
export async function resolveLiveTestSiteName(page: Page): Promise<string> {
  await gotoFacilitiesPage(page);

  const sharedCard = page
    .locator("[data-testid^='facility-row-']")
    .filter({ hasText: LIVE_E2E_SHARED_SITE_NAME });
  if ((await sharedCard.count()) > 0) {
    return LIVE_E2E_SHARED_SITE_NAME;
  }

  const firstRow = page.locator("[data-testid^='facility-row-']").first();
  if ((await firstRow.count()) > 0) {
    await expect(firstRow, "At least one site must exist for live E2E").toBeVisible({
      timeout: 30_000,
    });
    const title = firstRow.locator('[data-testid^="facility-name-"]').first();
    const name = (await title.innerText()).trim();
    if (!name) throw new Error("Could not read facility name from first row.");
    return name;
  }

  const firstCard = page.locator("[data-testid^='site-card-']").first();
  if ((await firstCard.count()) > 0) {
    await expect(firstCard, "At least one site must exist for live E2E").toBeVisible({
      timeout: 30_000,
    });
    const title = firstCard.locator(".text-lg").first();
    const name = (await title.innerText()).trim();
    if (name) return name;
  }

  const genericFirstRow = page.locator("tbody tr").first();
  await expect(genericFirstRow, "At least one facility row must exist for live E2E").toBeVisible({
    timeout: 30_000,
  });
  const rowNameCell = genericFirstRow.locator("td").nth(2);
  const rowName = (await rowNameCell.innerText()).trim();
  if (!rowName) throw new Error("Could not read site/facility name from first table row.");
  return rowName;
}

/**
 * @deprecated Use {@link resolveLiveTestSiteName} — never creates sites.
 */
export async function ensureTestSite(page: Page, _siteName?: string): Promise<string> {
  return resolveLiveTestSiteName(page);
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
