/** Dashboard deep-link paths under `/app` (shared by server attention items + client KPI cards). */
export function dashboardNavPath(pathWithQuery: string): string {
  const s = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  return `/app${s}`;
}

export const DASHBOARD_NAV = {
  inventoryStockLow: dashboardNavPath("/inventory/stock-overview?status=low"),
  inventoryStockOverview: dashboardNavPath("/inventory/stock-overview"),
  facilitiesActive: dashboardNavPath("/facilities/all?status=active"),
  facilitiesInactive: dashboardNavPath("/facilities/all?status=inactive"),
  requisitionsSubmitted: dashboardNavPath("/inventory/requisitions?status=submitted"),
  requisitionsAll: dashboardNavPath("/inventory/requisitions"),
  waybillsDispatched: dashboardNavPath("/inventory/issues?status=dispatched"),
  waybillsDraft: dashboardNavPath("/inventory/issues?status=draft"),
  receiptsDraft: dashboardNavPath("/inventory/receipts?status=draft"),
  stockCountsInProgress: dashboardNavPath("/inventory/counts?status=in_progress"),
  maintenance: dashboardNavPath("/maintenance"),
  assetValuation: dashboardNavPath("/assets"),
  insuranceExpiring: dashboardNavPath("/administration/compliance-register?tab=insurance&status=expiring"),
  vehiclesExpiring: dashboardNavPath("/administration/compliance-register?tab=vehicles&status=expiring"),
  generatorsOverdue: dashboardNavPath("/administration/compliance-register?tab=generators&status=overdue"),
  donorReportsDueSoon: dashboardNavPath("/administration/compliance-register?tab=donor&status=due-soon"),
  pendingUsers: dashboardNavPath("/settings/pending-users"),
  auditTrail: dashboardNavPath("/administration/activity-log"),
  activityLog: dashboardNavPath("/administration/activity-log"),
} as const;
