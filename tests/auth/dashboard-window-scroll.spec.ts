import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./live-helpers";

/**
 * Wave A6 regression: the window is the only scroller. Scrolling it to the bottom must leave
 * the page content (`app-page-main`) on screen with visible text, not a blank viewport.
 */
test.describe("dashboard window scroll (live)", () => {
  test("main content stays visible after scrolling the window to the bottom", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await loginAsAdmin(page);

    const main = page.getByTestId("app-page-main");
    await expect(main).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 30_000 });

    // Exactly one vertical scroller: no ancestor of main may scroll on its own.
    const nestedScrollers = await main.evaluate((el) => {
      const found: string[] = [];
      let node: HTMLElement | null = el;
      while (node && node !== document.body) {
        const cs = getComputedStyle(node);
        if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 1) {
          found.push(`${node.tagName.toLowerCase()}.${node.className.toString().slice(0, 60)}`);
        }
        node = node.parentElement;
      }
      return found;
    });
    expect(nestedScrollers).toEqual([]);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    const visible = await main.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const intersects = r.bottom > 0 && r.top < window.innerHeight;
      const text = (el.innerText || "").trim();
      return { intersects, hasText: text.length > 0, top: r.top, bottom: r.bottom };
    });
    expect(visible.intersects, JSON.stringify(visible)).toBe(true);
    expect(visible.hasText).toBe(true);
  });
});
