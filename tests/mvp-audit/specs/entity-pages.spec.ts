/**
 * One test per primary `/app/*` route (2d) — page loads without error boundary.
 */
import { test, expect } from "@playwright/test";
import { loginViaPassword } from "../helpers/e2eAuth";
import { shot } from "../helpers/shot";

const ROUTES: { path: string; slug: string; heading: string | RegExp }[] = [
  { path: "/app/facilities", slug: "facilities", heading: /Facilities Management/ },
  { path: "/app/work-orders", slug: "work-orders", heading: /Work Orders/ },
  { path: "/app/work-order-templates", slug: "work-order-templates", heading: /Work Order Templates/ },
  { path: "/app/maintenance", slug: "maintenance", heading: /Preventive Maintenance/ },
  { path: "/app/inventory", slug: "inventory", heading: /Inventory/ },
  { path: "/app/administration/compliance-register", slug: "compliance-register", heading: /Compliance Tracking/ },
  { path: "/app/reports/depreciation-schedule", slug: "depreciation-schedule", heading: /Depreciation/ },
  { path: "/app/settings/users", slug: "users", heading: /User Management/ },
  { path: "/app/pending-users", slug: "pending-users", heading: /User Access Requests/ },
  { path: "/app/report-scheduling", slug: "report-scheduling", heading: /Report Scheduling/ },
  { path: "/app/scanner", slug: "scanner", heading: /Asset Scanner/ },
  { path: "/app/asset-map", slug: "asset-map", heading: /Asset Map/ },
  { path: "/app/warranty-alerts", slug: "warranty-alerts", heading: /Warranty Alerts/ },
  { path: "/app/administration/activity-log", slug: "activity-log", heading: /Activity Log/ },
  { path: "/app/mobile-work-orders", slug: "mobile-work-orders", heading: /Work Orders/ },
  { path: "/app/reports", slug: "reports", heading: "Reports" },
  {
    path: "/app/notification-preferences",
    slug: "notification-preferences",
    heading: /Notification Preferences/,
  },
];

test.describe.configure({ mode: "serial" });

test.describe("Domain entity pages (2d)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginViaPassword(page);
  });

  for (const r of ROUTES) {
    test(`${r.slug} page loads`, async ({ page }) => {
      await page.goto(r.path);
      await expect(
        page.getByRole("heading", { level: 1, name: r.heading }),
      ).toBeVisible({
        timeout: 25_000,
      });
      await expect(page.getByText("An unexpected error occurred.")).toHaveCount(0);
      await shot(page, `entity-${r.slug}-loaded`);
    });
  }
});
