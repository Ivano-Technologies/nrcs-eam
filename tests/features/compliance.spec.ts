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

test.describe("Compliance register and activity log (live)", () => {
  test("compliance register and administration activity log", async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await loginAsAdmin(page);

    await page.goto("/app/administration/compliance-register");
    await expect(page.getByRole("heading", { name: /^Compliance Tracking$/ })).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByText("Vehicle, generator, building safety, donor reporting, and insurance compliance")
    ).toBeVisible();
    await expect(page).toHaveTitle(/NRCS Enterprise Asset Management System/i, { timeout: 15_000 });

    await page.goto("/app/administration/activity-log");
    await expect(page.getByRole("heading", { name: /^Activity Log$/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Audit trail of user actions and system changes")).toBeVisible();
    await expect(page.getByText("Filters", { exact: true }).first()).toBeVisible();

    await expect(
      page
        .getByText("No activity recorded yet.")
        .or(page.locator("table").first())
    ).toBeVisible({ timeout: 30_000 });

    const relevant = filterBenignConsoleErrors(errors).filter(
      (e) => !e.includes("TRPCClientError: Failed to fetch")
    );
    expect(relevant).toEqual([]);
  });
});
