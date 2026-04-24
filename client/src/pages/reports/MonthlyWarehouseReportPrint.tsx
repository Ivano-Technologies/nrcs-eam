import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { PrintableMonthlyReport } from "@/lib/document-printing/PrintableMonthlyReport";

export default function MonthlyWarehouseReportPrint() {
  const [, params] = useRoute("/app/reports/wms/monthly-warehouse-report/print/:warehouseId/:year/:month");
  const warehouseId = Number(params?.warehouseId ?? 0);
  const year = Number(params?.year ?? 0);
  const month = Number(params?.month ?? 0);

  const valid = warehouseId > 0 && year > 2000 && month >= 1 && month <= 12;
  const reportQuery = trpc.inventoryV2.reports.monthlyWarehouseReport.useQuery(
    { warehouseId, year, month },
    { enabled: valid }
  );
  const sitesQuery = trpc.sites.list.useQuery(undefined, { enabled: valid });

  if (!valid) {
    return <div className="p-6 text-sm text-red-600">Invalid monthly report print parameters.</div>;
  }
  if (reportQuery.isLoading || sitesQuery.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading monthly report print view...</div>;
  }
  if (!reportQuery.data) {
    return <div className="p-6 text-sm text-red-600">Monthly report not found.</div>;
  }

  const warehouseName =
    (sitesQuery.data ?? []).find((site) => site.id === warehouseId)?.name ?? `Warehouse #${warehouseId}`;

  return (
    <PrintableMonthlyReport
      rows={reportQuery.data}
      warehouseName={warehouseName}
      month={month}
      year={year}
    />
  );
}
