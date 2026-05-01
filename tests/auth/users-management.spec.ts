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

    let targetRowIndex = -1;
    let originalLabel = "User";
    let alternateLabel = "Staff";
    let dialog = page.getByRole("dialog", { name: "Edit user" });
    let save = dialog.getByRole("button", { name: /^Save$/ });

    for (let i = 1; i < n; i += 1) {
      const row = userRows.nth(i);
      const roleBadge = row.locator('[data-slot="badge"]').first();
      if ((await roleBadge.count()) === 0) continue;
      const rawRole = ((await roleBadge.textContent()) ?? "").trim().toLowerCase();
      const currentRole =
        rawRole === "admin" ||
        rawRole === "manager" ||
        rawRole === "staff" ||
        rawRole === "user" ||
        rawRole === "field"
          ? rawRole
          : "user";
      originalLabel = optionLabelForStoredRole(currentRole);
      alternateLabel = pickAlternateRoleLabel(currentRole);

      await row.getByRole("button", { name: "Edit" }).click();
      dialog = page.getByRole("dialog", { name: "Edit user" });
      await expect(dialog).toBeVisible({ timeout: 15_000 });

      const roleSelect = dialog.getByLabel("Role");
      await roleSelect.click();
      const listbox = page.getByRole("listbox").last();
      await expect(listbox).toBeVisible({ timeout: 10_000 });
      await listbox.getByRole("option", { name: new RegExp(`^${alternateLabel}$`) }).click();
      save = dialog.getByRole("button", { name: /^Save$/ });
      const enabled = await save.isEnabled().catch(() => false);
      if (enabled) {
        targetRowIndex = i;
        break;
      }
      await dialog.getByRole("button", { name: /^Cancel$/ }).click();
      await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    }

    if (targetRowIndex < 0) {
      testInfo.skip(true, "No mutable user row found (save remained disabled after role change)");
      return;
    }

    const updateWait = page.waitForResponse((res) => {
      const url = res.url();
      return res.status() < 500 && (url.includes("users.update") || url.includes("users.assignRole"));
    });
    await save.click();
    await updateWait;
    await expect(page.getByText(/User updated/i).first()).toBeVisible({ timeout: 30_000 });

    const targetRow = userRows.nth(targetRowIndex);
    await targetRow.getByRole("button", { name: "Edit" }).click();
    const dialog2 = page.getByRole("dialog", { name: "Edit user" });
    await expect(dialog2).toBeVisible({ timeout: 15_000 });
    const roleSelect2 = dialog2.getByLabel("Role");
    await roleSelect2.click();
    const listbox2 = page.getByRole("listbox").last();
    await expect(listbox2).toBeVisible({ timeout: 10_000 });
    await listbox2.getByRole("option", { name: new RegExp(`^${originalLabel}$`) }).click();
    const save2 = dialog2.getByRole("button", { name: /^Save$/ });
    const save2Enabled = await expect
      .poll(async () => await save2.isEnabled(), { timeout: 8_000 })
      .toBeTruthy()
      .then(
        () => true,
        () => false,
      );
    if (!save2Enabled) {
      const cancelBtn = dialog2.getByRole("button", { name: /^Cancel$|^Close$/ });
      if ((await cancelBtn.count()) > 0) {
        await cancelBtn.first().click();
      } else {
        await page.keyboard.press("Escape");
      }
      return;
    }
    const rollbackWait = page.waitForResponse((res) => {
      const url = res.url();
      return res.status() < 500 && (url.includes("users.update") || url.includes("users.assignRole"));
    });
    await save2.click();
    await rollbackWait;
    await expect(page.getByText(/User updated/i).first()).toBeVisible({ timeout: 30_000 });
  });
});
