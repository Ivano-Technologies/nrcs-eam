import { expect, type Page } from "@playwright/test";

/** Matches server/UI format `NRCS_{BRANCH_CODE}{CATEGORY_CODE}{NUM:04d}` (branch may include underscores). */
export const GENERATED_ASSET_CODE_RE = /^NRCS_[A-Z0-9_]+[A-Z]{2}\d{4}$/;

/**
 * Reads the Asset Code cell for the register row whose Item Description contains `itemDescription`.
 */
export async function readGeneratedAssetCodeFromRegister(
  page: Page,
  itemDescription: string,
): Promise<string> {
  await page.getByTestId("asset-search-input").fill(itemDescription);
  const row = page.locator(`[data-testid^="asset-row-"]`).filter({ hasText: itemDescription }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const code = (await row.locator("td").nth(8).innerText()).trim();
  expect(code).toMatch(GENERATED_ASSET_CODE_RE);
  return code;
}
