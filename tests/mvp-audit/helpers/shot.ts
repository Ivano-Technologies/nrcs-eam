import type { Page } from "@playwright/test";

const DIR = "tests/mvp-audit/screenshots";

export async function shot(page: Page, name: string) {
  await page.screenshot({
    path: `${DIR}/${name}.png`,
    fullPage: true,
  });
}
