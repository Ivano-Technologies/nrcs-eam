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
  const rowTestId = await row.getAttribute("data-testid");
  const rowId = rowTestId?.match(/^asset-row-(\d+)$/)?.[1];
  const codeCell = rowId
    ? page.getByTestId(`asset-register-code-${rowId}`)
    : row.locator("td").nth(8);
  await expect(codeCell).toBeVisible({ timeout: 15_000 });
  await expect(codeCell).toHaveText(GENERATED_ASSET_CODE_RE, { timeout: 60_000 });
  const code = (await codeCell.innerText()).trim();
  return code;
}
