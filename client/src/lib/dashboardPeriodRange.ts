import type { DashboardPeriod } from "@/components/dashboard/types";

/** Date range for waybill / distribution KPI deep links (inclusive start, inclusive end, ISO dates). */
export function dashboardPeriodDateRange(period: DashboardPeriod): { dateFrom: string; dateTo: string } {
  const to = new Date();
  const from = new Date(to);
  switch (period) {
    case "Today":
      from.setDate(from.getDate() - 1);
      break;
    case "Week":
      from.setDate(from.getDate() - 7);
      break;
    case "Quarter":
      from.setMonth(from.getMonth() - 3);
      break;
    case "Year":
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "Month":
    default:
      from.setMonth(from.getMonth() - 1);
      break;
  }
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

export function waybillsPeriodHref(period: DashboardPeriod): string {
  const { dateFrom, dateTo } = dashboardPeriodDateRange(period);
  const qs = new URLSearchParams({ status: "dispatched", dateFrom, dateTo });
  return `/app/inventory/issues?${qs.toString()}`;
}
