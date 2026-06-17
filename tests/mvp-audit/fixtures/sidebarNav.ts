/**
 * Admin-visible routes (paths + stable `data-testid`s). Order matches former alphabetical sweep;
 * navigation in dashboard.spec uses `page.goto(path)` because items are grouped in collapsible sections.
 */
export const SIDEBAR_NAV_ADMIN: { testId: string; path: string; shotSlug: string }[] = [
  { testId: "sidebar-nav-dashboard", path: "/app", shotSlug: "dashboard" },
  { testId: "sidebar-nav-activity-log", path: "/app/administration/activity-log", shotSlug: "activity-log" },
  { testId: "sidebar-nav-asset-map", path: "/app/asset-map", shotSlug: "asset-map" },
  { testId: "sidebar-nav-scanner", path: "/app/scanner", shotSlug: "scanner" },
  { testId: "sidebar-nav-assets", path: "/app/assets", shotSlug: "assets" },
  { testId: "sidebar-nav-compliance-register", path: "/app/administration/compliance-register", shotSlug: "compliance-register" },
  { testId: "sidebar-nav-dashboard-settings", path: "/app/dashboard-settings", shotSlug: "dashboard-settings" },
  { testId: "sidebar-nav-email-notifications", path: "/app/email-notifications", shotSlug: "email-notifications" },
  { testId: "sidebar-nav-inventory", path: "/app/inventory", shotSlug: "inventory" },
  { testId: "sidebar-nav-maintenance", path: "/app/maintenance", shotSlug: "maintenance" },
  { testId: "sidebar-nav-pending-users", path: "/app/pending-users", shotSlug: "pending-users" },
  { testId: "sidebar-nav-report-scheduling", path: "/app/report-scheduling", shotSlug: "report-scheduling" },
  { testId: "sidebar-nav-reports", path: "/app/reports", shotSlug: "reports" },
  { testId: "sidebar-nav-depreciation-schedule", path: "/app/reports/depreciation-schedule", shotSlug: "depreciation-schedule" },
  { testId: "sidebar-nav-facilities", path: "/app/facilities", shotSlug: "facilities" },
  { testId: "sidebar-nav-settings-users", path: "/app/settings/users", shotSlug: "users" },
  { testId: "sidebar-nav-warranty-alerts", path: "/app/warranty-alerts", shotSlug: "warranty-alerts" },
  { testId: "sidebar-nav-work-order-templates", path: "/app/work-order-templates", shotSlug: "work-order-templates" },
  { testId: "sidebar-nav-work-orders", path: "/app/work-orders", shotSlug: "work-orders" },
];
