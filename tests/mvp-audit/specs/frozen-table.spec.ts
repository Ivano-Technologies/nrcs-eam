import { expect, test, type Page, type Locator } from "@playwright/test";
import { loginViaPassword } from "../helpers/e2eAuth";

/**
 * Verifies `.frozen-table-wrap`: scrollable body with thead rows sticky on vertical scroll
 * (header-only freeze; columns scroll horizontally with the table).
 *
 * Covers Asset Register (double-header) and Facilities (single-header).
 */

async function expectHeaderFrozenTable(
  page: Page,
  url: string,
  opts: { doubleHeader?: boolean },
) {
  await page.goto(url);

  const wrap: Locator = page.locator(".frozen-table-wrap").first();
  await expect(wrap, `expected .frozen-table-wrap on ${url}`).toBeVisible({
    timeout: 30_000,
  });

  await expect(wrap.locator("table thead")).toBeVisible({ timeout: 30_000 });

  const headerRows = wrap.locator("table thead tr");
  const headerRowCount = await headerRows.count();
  expect(headerRowCount, `expected >=1 header row on ${url}`).toBeGreaterThanOrEqual(1);
  if (opts.doubleHeader) {
    expect(headerRowCount, "expected double-header layout").toBe(2);
  }

  const columnHeaderRow = headerRows.nth(headerRowCount - 1);
  const headerCells = columnHeaderRow.locator("th");
  const cellsCount = await headerCells.count();
  expect(cellsCount, `expected column headers on ${url}`).toBeGreaterThan(0);

  for (let i = 0; i < cellsCount; i += 1) {
    const pos = await headerCells.nth(i).evaluate((el) => getComputedStyle(el).position);
    expect(pos, `header cell ${i} on ${url} should be sticky`).toBe("sticky");
  }

  // Horizontal scroll: first header cell should move with the table (no sticky columns).
  const beforeScrollX = Math.round((await headerCells.nth(0).boundingBox())!.x);
  await wrap.evaluate((el) => {
    el.scrollLeft = 300;
  });
  await page.waitForTimeout(150);
  const afterScrollX = Math.round((await headerCells.nth(0).boundingBox())!.x);
  expect(
    Math.abs(afterScrollX - beforeScrollX),
    `header cell 0 on ${url} should move horizontally when scrollLeft=300 (no frozen columns)`,
  ).toBeGreaterThan(20);

  // Vertical scroll: header band stays pinned near the top of the scrollport.
  await wrap.evaluate((el) => {
    el.scrollLeft = 0;
    el.scrollTop = 300;
  });
  await page.waitForTimeout(150);

  const afterVertical = await headerCells.nth(0).boundingBox();
  expect(afterVertical, `header cell bbox after vertical scroll on ${url}`).not.toBeNull();
  const wrapBox = await wrap.boundingBox();
  expect(wrapBox, `frozen table wrapper bbox on ${url}`).not.toBeNull();

  const stickyBandPx = opts.doubleHeader ? 90 : 40;
  const topDelta = Math.round(afterVertical!.y - wrapBox!.y);
  expect(
    topDelta,
    `header row on ${url} should remain within sticky band; got delta ${topDelta}px`,
  ).toBeLessThanOrEqual(stickyBandPx);
  expect(
    topDelta,
    `header row on ${url} moved above wrapper top unexpectedly (delta ${topDelta}px)`,
  ).toBeGreaterThanOrEqual(-2);

  await wrap.evaluate((el) => {
    el.scrollLeft = 0;
    el.scrollTop = 0;
  });
}

test.describe.configure({ mode: "serial" });

test.describe("Frozen table header-only sticky behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginViaPassword(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("Asset Register double header stays pinned on vertical scroll", async ({ page }) => {
    await expectHeaderFrozenTable(page, "/app/assets", { doubleHeader: true });
  });

  test("Facilities list single header stays pinned on vertical scroll", async ({ page }) => {
    await expectHeaderFrozenTable(page, "/app/facilities/all", { doubleHeader: false });
  });
});
