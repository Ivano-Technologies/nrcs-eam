import { test, expect } from "@playwright/test";

/**
 * Wave A1: keyboard focus on buttons must draw a visible ring.
 * Tailwind v4 `outline-none` sets `--tw-outline-style: none`, so a width/colour alone stayed invisible;
 * the Button base now sets `focus-visible:outline-solid`.
 *
 * Run against a Preview: PLAYWRIGHT_LIVE_AUTH=1 PLAYWRIGHT_BASE_URL=https://<preview> pnpm exec playwright test --project=public-ui
 */
for (const theme of ["light", "dark"] as const) {
  test(`login submit shows a solid focus ring on Tab (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => {
      window.localStorage.setItem("nrcs-theme", t);
    }, theme);
    await page.goto("/login");

    const submit = page.getByTestId("login-password-submit");
    await expect(submit).toBeVisible({ timeout: 30_000 });

    // Focus the password field, then Tab: the next stop is the password visibility toggle, then submit.
    await page.getByTestId("login-password-input").focus();
    for (let i = 0; i < 4; i += 1) {
      if (await submit.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(submit).toBeFocused();

    const outline = await submit.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: cs.outlineWidth };
    });
    expect(outline.style).toBe("solid");
    expect(Number.parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  });
}

test("theme toggle has an accessible name and pressed state", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("nrcs-theme", "light"));
  await page.goto("/login");
  const toggle = page.getByRole("button", { name: "Switch to dark theme" });
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const box = await toggle.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  await toggle.click();
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toHaveAttribute("aria-pressed", "true");
});
