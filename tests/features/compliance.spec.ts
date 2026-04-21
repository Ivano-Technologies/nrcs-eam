import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../auth/live-helpers";
import { filterBenignConsoleErrors } from "../mvp-audit/helpers/guards";

function attachConsoleCapture(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

test.describe("Compliance and audit trail (live)", () => {
  test("compliance page and audit trail activity log", async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await loginAsAdmin(page);

    await page.goto("/app/compliance");
    await expect(page.getByRole("heading", { name: /^Compliance Tracking$/ })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Manage regulatory requirements")).toBeVisible();
    await expect(page).toHaveTitle(/NRCS Enterprise Asset Management System/i, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Add Record/i })).toBeVisible();

    await expect(page.getByRole("heading", { name: /^Compliance Tracking$/ })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto("/app/audit-trail");
    await expect(page.getByRole("heading", { name: /^Audit Trail$/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Complete history of all system changes")).toBeVisible();
    await expect(page.getByText("Filters", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByTestId("app-page-main").getByText("Activity Log", { exact: true })
    ).toBeVisible();

    await expect(
      page
        .getByText("No audit logs found")
        .or(page.locator(".border-l-4.border-primary").first())
    ).toBeVisible({ timeout: 30_000 });

    const relevant = filterBenignConsoleErrors(errors).filter(
      (e) => !e.includes("TRPCClientError: Failed to fetch")
    );
    expect(relevant).toEqual([]);
  });
});
