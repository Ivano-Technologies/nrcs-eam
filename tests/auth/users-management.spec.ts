import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./live-helpers";

function optionLabelForStoredRole(role: string): string {
  const r = role.toLowerCase();
  if (r === "admin") return "Admin";
  if (r === "manager") return "Manager";
  if (r === "staff") return "Staff";
  if (r === "field") return "Field";
  return "User";
}

/** Pick a role different from `current` so the Select fires onValueChange. */
function pickAlternateRoleLabel(current: string): string {
  const o = current.toLowerCase();
  if (o === "staff") return "User";
  if (o === "user") return "Staff";
  if (o === "field") return "Staff";
  if (o === "manager") return "User";
  if (o === "admin") return "User";
  return "Staff";
}

test.describe("user management (live)", () => {
  test("pending users page loads; admin can edit another user's role from User Management", async ({
    page,
  }, testInfo) => {
    await loginAsAdmin(page);

    await page.goto("/app/users/pending");
    const pendingHeading = page.getByTestId("pending-users-heading");
    if ((await pendingHeading.count()) > 0) {
      await expect(pendingHeading).toBeVisible({ timeout: 30_000 });
    } else {
      await expect(page.getByRole("heading", { name: /User Access Requests/i })).toBeVisible({
        timeout: 30_000,
      });
    }
    await expect(
      page
        .getByText(/User Access Requests|No pending user requests at this time|Pending Requests/i)
        .first()
    ).toBeVisible();

    await page.goto("/app/settings/users");
    await expect(page.getByRole("heading", { name: /User Management/i })).toBeVisible({
      timeout: 30_000,
    });

    const userRows = page.locator("[data-testid^='user-row-']");
    const n = await userRows.count();
    if (n < 2) {
      testInfo.skip(true, "Need at least 2 users for role-change test");
      return;
    }

    const secondRow = userRows.nth(1);
    const roleBadge = secondRow.locator('[data-slot="badge"]').first();
    await expect(roleBadge).toBeVisible({ timeout: 15_000 });
    const rawRole = ((await roleBadge.textContent()) ?? "").trim().toLowerCase();
    const currentRole =
      rawRole === "admin" ||
      rawRole === "manager" ||
      rawRole === "staff" ||
      rawRole === "user" ||
      rawRole === "field"
        ? rawRole
        : "user";

    const originalLabel = optionLabelForStoredRole(currentRole);
    const alternateLabel = pickAlternateRoleLabel(currentRole);

    await secondRow.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit user" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const roleSelect = dialog.getByLabel("Role");
    await roleSelect.click();
    const listbox = page.getByRole("listbox").last();
    await expect(listbox).toBeVisible({ timeout: 10_000 });
    await listbox.getByRole("option", { name: new RegExp(`^${alternateLabel}$`) }).click();
    await dialog.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByText(/User updated/i)).toBeVisible({ timeout: 30_000 });

    await secondRow.getByRole("button", { name: "Edit" }).click();
    const dialog2 = page.getByRole("dialog", { name: "Edit user" });
    await expect(dialog2).toBeVisible({ timeout: 15_000 });
    const roleSelect2 = dialog2.getByLabel("Role");
    await roleSelect2.click();
    const listbox2 = page.getByRole("listbox").last();
    await expect(listbox2).toBeVisible({ timeout: 10_000 });
    await listbox2.getByRole("option", { name: new RegExp(`^${originalLabel}$`) }).click();
    await dialog2.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByText(/User updated/i)).toBeVisible({ timeout: 30_000 });
  });
});
