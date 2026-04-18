/**
 * Admin-visible routes (paths + stable `data-testid`s). Order matches former alphabetical sweep;
 * navigation in dashboard.spec uses `page.goto(path)` because items are grouped in collapsible sections.
 */
export const SIDEBAR_NAV_ADMIN: { testId: string; path: string; shotSlug: string }[] = [
  { testId: "sidebar-nav-dashboard", path: "/app", shotSlug: "dashboard" },
  { testId: "sidebar-nav-activity-log", path: "/app/activity-log", shotSlug: "activity-log" },
  { testId: "sidebar-nav-asset-map", path: "/app/asset-map", shotSlug: "asset-map" },
  { testId: "sidebar-nav-scanner", path: "/app/scanner", shotSlug: "scanner" },
  { testId: "sidebar-nav-assets", path: "/app/assets", shotSlug: "assets" },
  { testId: "sidebar-nav-audit-trail", path: "/app/audit-trail", shotSlug: "audit-trail" },
  { testId: "sidebar-nav-compliance", path: "/app/compliance", shotSlug: "compliance" },
  { testId: "sidebar-nav-cost-analytics", path: "/app/cost-analytics", shotSlug: "cost-analytics" },
  { testId: "sidebar-nav-dashboard-settings", path: "/app/dashboard-settings", shotSlug: "dashboard-settings" },
  { testId: "sidebar-nav-email-notifications", path: "/app/email-notifications", shotSlug: "email-notifications" },
  { testId: "sidebar-nav-financial", path: "/app/financial", shotSlug: "financial" },
  { testId: "sidebar-nav-inventory", path: "/app/inventory", shotSlug: "inventory" },
  { testId: "sidebar-nav-maintenance", path: "/app/maintenance", shotSlug: "maintenance" },
  { testId: "sidebar-nav-pending-users", path: "/app/pending-users", shotSlug: "pending-users" },
  { testId: "sidebar-nav-quickbooks", path: "/app/quickbooks", shotSlug: "quickbooks" },
  { testId: "sidebar-nav-report-scheduling", path: "/app/report-scheduling", shotSlug: "report-scheduling" },
  { testId: "sidebar-nav-reports", path: "/app/reports", shotSlug: "reports" },
  { testId: "sidebar-nav-sites", path: "/app/sites", shotSlug: "sites" },
  { testId: "sidebar-nav-users", path: "/app/users", shotSlug: "users" },
  { testId: "sidebar-nav-vendors", path: "/app/vendors", shotSlug: "vendors" },
  { testId: "sidebar-nav-warranty-alerts", path: "/app/warranty-alerts", shotSlug: "warranty-alerts" },
  { testId: "sidebar-nav-work-order-templates", path: "/app/work-order-templates", shotSlug: "work-order-templates" },
  { testId: "sidebar-nav-work-orders", path: "/app/work-orders", shotSlug: "work-orders" },
];
