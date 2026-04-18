import { test, expect } from "@playwright/test";
import { deleteUserByEmailViaUi, runLiveBrowserCleanup } from "../helpers/liveTestData";

/**
 * Live: public signup only creates pending_users; admin approves → users + Supabase Auth.
 * Requires admin credentials with access to Pending Users and User Management.
 *
 * Deploy the signup fix first: older production builds could hit Supabase rate limits on signup
 * (open registration). After deploy, signup is DB-only until approval.
 */
test.describe.configure({ timeout: 180_000 });

const ADMIN_EMAIL =
  process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "ivanonigeria@gmail.com";
const ADMIN_PASSWORD =
  process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "ChangeMe123!";

// Skipped: requires test data creation in production DB (pending users / approved test accounts)
test.describe.skip("signup approval flow (live)", () => {
  /** Approved user email — deleted in afterAll so production is not left with E2E users. */
  let signupTestEmail: string | undefined;

  test.afterAll(async () => {
    if (!signupTestEmail) return;
    await runLiveBrowserCleanup((page) => deleteUserByEmailViaUi(page, signupTestEmail!));
  });

  test("shows pending message, user not listed until approved, then listed after approval", async ({
    page,
  }) => {
    const unique = `e2e-signup-${Date.now()}@gmail.com`;
    signupTestEmail = unique;
    const displayName = `E2E Signup ${Date.now()}`;

    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel("Full Name").fill(displayName);
    await page.getByLabel("Email Address").fill(unique);
    await page.getByLabel("Designation").fill("Officer");
    await page.getByLabel("Department").fill("Logistics");
    await page.getByRole("button", { name: "Request Access" }).click();

    const successLocator = page
      .getByTestId("signup-success-message")
      .or(
        page.getByText(
          /Access request submitted!|Your request will be reviewed by an administrator/i
        )
      );
    await expect(successLocator.first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(successLocator.first()).toContainText(/administrator|review your request/i);

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(ADMIN_EMAIL);
    await page.getByTestId("login-password-input").fill(ADMIN_PASSWORD);
    await page.getByTestId("login-password-submit").click();
    await expect(page).toHaveURL(/\/app/, { timeout: 60_000 });

    await page.goto("/app/users");
    await expect(page.getByText(unique, { exact: true })).toHaveCount(0);

    await page.goto("/app/users/pending");
    await expect(page.getByText(unique, { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    const card = page
      .locator("div")
      .filter({ hasText: unique })
      .filter({ has: page.getByRole("button", { name: "Approve" }) })
      .first();
    await expect(card).toBeVisible();

    const onDialog = (d: { accept: () => void }) => void d.accept();
    page.on("dialog", onDialog);
    await card.getByRole("button", { name: "Approve" }).click();
    await page.waitForTimeout(4000);
    page.removeListener("dialog", onDialog);

    await page.goto("/app/users");
    await expect(page.getByText(unique, { exact: true })).toBeVisible({
      timeout: 60_000,
    });
  });
});
