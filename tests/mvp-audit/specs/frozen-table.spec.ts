import { expect, test, type Page, type Locator } from "@playwright/test";
import { loginViaMagicLink } from "../helpers/e2eAuth";

/**
 * Verifies frozen-table-wrap behavior on tables with sticky thead and the
 * first 3 sticky body columns. Asserts both the computed style and the
 * actual scroll-time position invariance.
 *
 * Covers Asset Register (double-header) and Facilities (single-header).
 */

type StickyAssertions = {
  /** First N table-header cells we expect to stay pinned horizontally. */
  stickyColumnCount: number;
  /** Whether the table renders two stacked thead rows (Asset Register). */
  doubleHeader?: boolean;
};

async function expectStickyTable(
  page: Page,
  url: string,
  opts: StickyAssertions,
) {
  await page.goto(url);

  const wrap: Locator = page.locator(".frozen-table-wrap").first();
  await expect(wrap, `expected .frozen-table-wrap on ${url}`).toBeVisible({
    timeout: 30_000,
  });

  // Wait for at least one body row OR an empty-state cell to settle layout.
  await expect(wrap.locator("table thead")).toBeVisible({ timeout: 30_000 });

  // Locate the column-header row (last thead row). For double-header tables
  // the second tr holds the actual column headers and sticky offsets.
  const headerRows = wrap.locator("table thead tr");
  const headerRowCount = await headerRows.count();
  expect(headerRowCount, `expected >=1 header row on ${url}`).toBeGreaterThanOrEqual(1);
  if (opts.doubleHeader) {
    expect(headerRowCount, "expected double-header layout").toBe(2);
  }
  const columnHeaderRow = headerRows.nth(headerRowCount - 1);
  const headerCells = columnHeaderRow.locator("th");

  // Snapshot pre-scroll x positions for the first N sticky columns.
  const before: number[] = [];
  for (let i = 0; i < opts.stickyColumnCount; i += 1) {
    const box = await headerCells.nth(i).boundingBox();
    expect(box, `header cell ${i} should have a bounding box on ${url}`).not.toBeNull();
    before.push(Math.round(box!.x));
  }

  // Computed-style assertion: each sticky column header reports position:sticky.
  for (let i = 0; i < opts.stickyColumnCount; i += 1) {
    const pos = await headerCells.nth(i).evaluate((el) => getComputedStyle(el).position);
    expect(pos, `column ${i} on ${url} should be sticky`).toBe("sticky");
  }

  // Scroll horizontally inside the wrap, then re-read the column header x.
  await wrap.evaluate((el) => {
    el.scrollLeft = 300;
  });
  await page.waitForTimeout(150);

  for (let i = 0; i < opts.stickyColumnCount; i += 1) {
    const box = await headerCells.nth(i).boundingBox();
    expect(box, `header cell ${i} bbox after scroll on ${url}`).not.toBeNull();
    const dx = Math.abs(Math.round(box!.x) - before[i]);
    expect(
      dx,
      `column ${i} on ${url} drifted ${dx}px after scrollLeft=300; expected sticky`,
    ).toBeLessThanOrEqual(2);
  }

  // Scroll vertically inside the wrap, then ensure sticky header keeps its y.
  await wrap.evaluate((el) => {
    el.scrollTop = 300;
  });
  await page.waitForTimeout(150);

  const afterVertical = await headerCells.nth(0).boundingBox();
  expect(afterVertical, `header cell bbox after vertical scroll on ${url}`).not.toBeNull();
  const wrapBox = await wrap.boundingBox();
  expect(wrapBox, `frozen table wrapper bbox on ${url}`).not.toBeNull();

  // For single header tables, the first row should pin near wrap top.
  // For double-header tables, the measured row can settle one row lower,
  // so allow a wider sticky band while still requiring it to remain near top.
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

  // Reset scroll for clean teardown.
  await wrap.evaluate((el) => {
    el.scrollLeft = 0;
    el.scrollTop = 0;
  });
}

test.describe.configure({ mode: "serial" });

test.describe("Frozen table sticky behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginViaMagicLink(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("Asset Register freezes first 3 columns and double header", async ({ page }) => {
    await expectStickyTable(page, "/app/assets", {
      stickyColumnCount: 3,
      doubleHeader: true,
    });
  });

  test("Facilities list freezes first 3 columns and single header", async ({ page }) => {
    await expectStickyTable(page, "/app/facilities/all", {
      stickyColumnCount: 3,
      doubleHeader: false,
    });
  });
});
