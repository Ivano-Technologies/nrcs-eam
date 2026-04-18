import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./live-helpers";

function optionLabelForStoredRole(role: string): string {
  const r = role.toLowerCase();
  if (r === "admin") return "Admin";
  if (r === "manager") return "Manager";
  if (r === "technician") return "Technician";
  return "User";
}

/** Pick a role different from `current` so the Select fires onValueChange. */
function pickAlternateRoleLabel(current: string): string {
  const o = current.toLowerCase();
  if (o === "technician") return "User";
  if (o === "user") return "Technician";
  if (o === "manager") return "User";
  if (o === "admin") return "User";
  return "Technician";
}

/** Production may show a confirm dialog or apply the role and toast immediately. */
async function confirmRoleIfNeeded(page: import("@playwright/test").Page) {
  const dialogTitle = page.getByText("Confirm Role Change", { exact: true });
  const alreadySuccess = await page.getByText(/Role updated/i).isVisible().catch(() => false);
  if (alreadySuccess) return;

  const dialogVisible = await dialogTitle.isVisible().catch(() => false);
  if (!dialogVisible) return;

  const confirmBtn = page.getByTestId("user-role-confirm-btn");
  if ((await confirmBtn.count()) > 0 && (await confirmBtn.first().isVisible())) {
    await confirmBtn.first().click();
    return;
  }
  await page
    .locator('[role="dialog"]')
    .filter({ has: dialogTitle })
    .getByRole("button", { name: /^Confirm$/ })
    .click();
}

async function afterSelectingRoleOption(page: import("@playwright/test").Page) {
  await Promise.race([
    page.getByText("Confirm Role Change", { exact: true }).waitFor({
      state: "visible",
      timeout: 20_000,
    }),
    page.getByText(/Role updated/i).waitFor({ state: "visible", timeout: 20_000 }),
  ]);
  await confirmRoleIfNeeded(page);
}

test.describe("user management (live)", () => {
  test("pending users page loads; admin can change another user's role", async ({
    page,
  }, testInfo) => {
    await loginAsAdmin(page);

    await page.goto("/app/users/pending");
    const pendingHeading = page.getByTestId("pending-users-heading");
    if ((await pendingHeading.count()) > 0) {
      await expect(pendingHeading).toBeVisible({ timeout: 30_000 });
    } else {
      await expect(
        page.getByRole("heading", { name: /User Access Requests/i })
      ).toBeVisible({ timeout: 30_000 });
    }
    await expect(
      page
        .getByText(/User Access Requests|No pending user requests at this time|Pending Requests/i)
        .first()
    ).toBeVisible();

    await page.goto("/app/users");
    await expect(page.getByRole("heading", { name: /User Management/i })).toBeVisible({
      timeout: 30_000,
    });

    const userCards = page.locator("[data-testid^='user-card-']");
    const n = await userCards.count();
    const changeRoleLabels = page.getByText("Change Role", { exact: true });
    const nByLabel = await changeRoleLabels.count();
    if (n < 2 && nByLabel < 2) {
      testInfo.skip(true, "Need at least 2 users for role-change test");
      return;
    }

    const secondCard =
      n >= 2
        ? userCards.nth(1)
        : page.locator("div.space-y-6 > div.grid").first().locator("> div").nth(1);

    const roleBadge = secondCard.locator('[data-slot="badge"]').first();
    await expect(roleBadge).toBeVisible({ timeout: 15_000 });
    const rawRole = ((await roleBadge.textContent()) ?? "").trim().toLowerCase();
    const currentRole =
      rawRole === "admin" ||
      rawRole === "manager" ||
      rawRole === "technician" ||
      rawRole === "user"
        ? rawRole
        : "user";

    const originalLabel = optionLabelForStoredRole(currentRole);
    const alternateLabel = pickAlternateRoleLabel(currentRole);

    let roleSelect =
      n >= 2
        ? userCards.nth(1).locator("[data-testid^='user-role-select-']")
        : changeRoleLabels.nth(1).locator("..").getByRole("combobox");
    if ((await roleSelect.count()) === 0) {
      roleSelect = secondCard.getByRole("combobox");
    }

    await expect(roleSelect).toBeVisible();
    await roleSelect.click();
    const listbox = page.getByRole("listbox").last();
    await expect(listbox).toBeVisible({ timeout: 10_000 });
    await listbox
      .getByRole("option", { name: new RegExp(`^${alternateLabel}$`) })
      .click();
    await afterSelectingRoleOption(page);
    await expect(page.getByText(/Role updated/i)).toBeVisible({ timeout: 30_000 });

    await roleSelect.click();
    const listbox2 = page.getByRole("listbox").last();
    await expect(listbox2).toBeVisible({ timeout: 10_000 });
    await listbox2
      .getByRole("option", { name: new RegExp(`^${originalLabel}$`) })
      .click();
    await afterSelectingRoleOption(page);
    await expect(page.getByText(/Role updated/i)).toBeVisible({ timeout: 30_000 });
  });
});
