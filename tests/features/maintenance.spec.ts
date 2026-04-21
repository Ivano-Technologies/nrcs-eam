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

test.describe("Maintenance module (live)", () => {
  test("preventive maintenance page, schedules or empty state, add schedule, dashboard widget", async ({
    page,
  }) => {
    const errors = attachConsoleCapture(page);
    await loginAsAdmin(page);

    await page.goto("/app/maintenance");
    await expect(page.getByRole("heading", { name: /^Preventive Maintenance$/ })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Manage maintenance schedules")).toBeVisible();
    await expect(page).toHaveTitle(/NRCS Enterprise Asset Management System/i, { timeout: 15_000 });

    const allSchedulesCard = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText("All Schedules", { exact: true }) });
    await expect(
      allSchedulesCard
        .getByText("No schedules found")
        .or(allSchedulesCard.locator("p.font-medium").first())
    ).toBeVisible({ timeout: 30_000 });

    await expect(page.getByRole("button", { name: /Add Schedule/i })).toBeVisible();

    await page.getByTestId("sidebar-nav-work-orders").click();
    await expect(page).toHaveURL(/\/app\/work-orders/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /^Work Orders$/ })).toBeVisible({ timeout: 30_000 });

    await page.goto("/app");
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 30_000 });
    await expect(
      page
        .getByText("Needs your attention")
        .or(page.getByText("Low Stock Items"))
        .or(page.getByText("Stock Movement"))
        .first()
    ).toBeVisible({ timeout: 30_000 });

    const relevant = filterBenignConsoleErrors(errors).filter(
      (e) => !e.includes("TRPCClientError: Failed to fetch")
    );
    expect(relevant).toEqual([]);
  });
});
