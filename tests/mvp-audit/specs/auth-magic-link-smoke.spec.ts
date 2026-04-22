import { expect, test } from "@playwright/test";
import { testUser } from "../fixtures/testUser";
import { generateMagicLinkForTestUser } from "../fixtures/supabaseAuth";
import { runSeedE2E } from "../helpers/e2eAuth";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

test("auth magic-link smoke: generateLink -> verify -> redirect -> persisted session", async ({ page }) => {
  runSeedE2E();

  const magicLink = await generateMagicLinkForTestUser();
  expect(magicLink.actionLink).toContain("token_hash=");
  expect(magicLink.hashedToken.length).toBeGreaterThan(10);

  const verifyUrl = new URL("/auth/verify", "http://127.0.0.1:3000");
  verifyUrl.searchParams.set("email", testUser.email);
  verifyUrl.searchParams.set("token_hash", magicLink.hashedToken);
  verifyUrl.searchParams.set("type", "email");

  await page.goto(verifyUrl.toString());
  await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 20_000,
  });

  await page.goto("/app/inventory/receipts");
  await expect(page).toHaveURL(/\/app\/inventory\/receipts/);
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible({
    timeout: 20_000,
  });
});
