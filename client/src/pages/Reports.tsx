import { useEffect, useMemo, useState } from "react";
import { Toolbar } from "@/components/Toolbar";
import { DateHint } from "@/lib/format";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import PageHeader from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { downloadBase64File } from "@/lib/download";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { Download, FileBarChart, Loader2 } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ReportCard = { id: string; label: string };
const categories: Array<{ key: string; title: string; reports: ReportCard[] }> = [
  {
    key: "stock",
    title: "Stock reports",
    reports: [
      { id: "stockStatus", label: "Current stock status" },
      { id: "warehouseUtilization", label: "Warehouse performance" },
      { id: "forecastDemand", label: "Demand forecast" },
    ],
  },
  {
    key: "movement",
    title: "Movement reports",
    reports: [
      { id: "stockMovement", label: "Movement analysis" },
      { id: "abcAnalysis", label: "ABC analysis" },
      { id: "fnsAnalysis", label: "FNS analysis" },
    ],
  },
  {
    key: "expiry",
    title: "Expiry reports",
    reports: [
      { id: "expiryForecast", label: "Expiry forecast" },
      { id: "vedAnalysis", label: "VED analysis" },
    ],
  },
  {
    key: "distribution",
    title: "Distribution reports",
    reports: [{ id: "distributionSummary", label: "Distribution summary" }],
  },
];

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { isManagerOrAdmin, isAdmin } = usePermissions();
  const [selectedReport, setSelectedReport] = useState("stockStatus");
  const [warehouseId, setWarehouseId] = useState("all");
  const [category, setCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [branchSummarySiteId, setBranchSummarySiteId] = useState<string>("");
  const [branchSummaryConsolidated, setBranchSummaryConsolidated] = useState(false);

  const { data: sites } = trpc.sites.list.useQuery();
  const branchSummaryPdf = trpc.reports.branchSummaryPdf.useMutation();

  const branchSummaryFacilityOptions = useMemo(() => {
    const rows = sites ?? [];
    if (isAdmin) return rows;
    return rows.filter(
      (s: { facilityType?: string }) => s.facilityType === "branch" || s.facilityType === "national_headquarters"
    );
  }, [sites, isAdmin]);

  const selectedBranchSummarySite = useMemo(
    () => branchSummaryFacilityOptions.find((s: { id: number }) => String(s.id) === branchSummarySiteId),
    [branchSummaryFacilityOptions, branchSummarySiteId]
  );

  useEffect(() => {
    if (selectedBranchSummarySite?.facilityType !== "national_headquarters") {
      setBranchSummaryConsolidated(false);
    }
  }, [selectedBranchSummarySite?.facilityType]);
  const { data: stockStatus } = trpc.inventoryV2.reports.stockStatus.useQuery({
    warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
    category: category === "all" ? undefined : (category as any),
  });
  const { data: stockMovement } = trpc.inventoryV2.reports.stockMovement.useQuery({
    startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000),
    endDate: endDate ? new Date(endDate) : new Date(),
  });
  const { data: expiryForecast } = trpc.inventoryV2.reports.expiryForecast.useQuery();
  const { data: distributionSummary } = trpc.inventoryV2.reports.distributionSummary.useQuery({
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  });
  const { data: vedAnalysis } = trpc.inventoryV2.reports.vedAnalysis.useQuery();
  const { data: abcAnalysis } = trpc.inventoryV2.reports.abcAnalysis.useQuery();
  const { data: fnsAnalysis } = trpc.inventoryV2.reports.fnsAnalysis.useQuery();
  const { data: forecastDemand } = trpc.inventoryV2.reports.forecastDemand.useQuery();
  const { data: warehouseUtilization } = trpc.inventoryV2.reports.warehouseUtilization.useQuery();

  const asRows = (value: unknown): any[] => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object" && Array.isArray((value as { data?: unknown[] }).data)) {
      return (value as { data: unknown[] }).data as any[];
    }
    return [];
  };

  const abcRows = asRows(abcAnalysis);
  const fnsRows = asRows(fnsAnalysis);
  const forecastRows = asRows(forecastDemand);
  const warehouseRows = asRows(warehouseUtilization);

  const tableRows = useMemo(() => {
    switch (selectedReport) {
      case "stockStatus":
        return stockStatus ?? [];
      case "stockMovement":
        return asRows((stockMovement as any)?.fastMovingItems ?? stockMovement);
      case "expiryForecast":
        return asRows((expiryForecast as any)?.highestRiskItems ?? expiryForecast);
      case "distributionSummary":
        return distributionSummary?.distributionsByLocation ?? [];
      case "vedAnalysis":
        return vedAnalysis ?? [];
      case "abcAnalysis":
        return abcRows;
      case "fnsAnalysis":
        return fnsRows;
      case "warehouseUtilization":
        return warehouseRows;
      case "forecastDemand":
        return forecastRows;
      default:
        return [];
    }
  }, [
    selectedReport,
    stockStatus,
    stockMovement,
    expiryForecast,
    distributionSummary,
    vedAnalysis,
    abcAnalysis,
    fnsAnalysis,
    warehouseUtilization,
    forecastDemand,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileBarChart}
        title="Reports overview"
        subtitle="Inventory intelligence, VED/ABC/FNS analysis, and forecasting."
      />

      {isManagerOrAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Branch summary (management)</CardTitle>
            <CardDescription>
              One-page PDF: assets, stock readiness, requisitions, low stock, and recent activity for a branch or NHQ
              consolidated view.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1">
              <Label>Facility</Label>
              <Select value={branchSummarySiteId} onValueChange={setBranchSummarySiteId}>
                <SelectTrigger className="w-[280px]" data-testid="branch-summary-site-select">
                  <SelectValue placeholder="Select branch or NHQ" />
                </SelectTrigger>
                <SelectContent>
                  {branchSummaryFacilityOptions.map((s: { id: number; name: string }) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedBranchSummarySite?.facilityType === "national_headquarters" ? (
              <div className="flex items-center gap-2 pb-1">
                <Checkbox
                  id="branch-summary-consolidated"
                  checked={branchSummaryConsolidated}
                  onCheckedChange={(v) => setBranchSummaryConsolidated(v === true)}
                />
                <Label htmlFor="branch-summary-consolidated" className="cursor-pointer text-sm font-normal">
                  Consolidated (all branches)
                </Label>
              </div>
            ) : null}
            <Button
              disabled={!branchSummarySiteId || branchSummaryPdf.isPending}
              onClick={async () => {
                try {
                  const file = await branchSummaryPdf.mutateAsync({
                    siteId: Number(branchSummarySiteId),
                    consolidated: branchSummaryConsolidated || undefined,
                  });
                  downloadBase64File(file.data, file.filename, file.mimeType);
                  toast.success("Branch summary downloaded");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Download failed");
                }
              }}
            >
              {branchSummaryPdf.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download branch report
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Toolbar data-testid="reports-toolbar" align="end"
        filters={
          <>
          <div className="space-y-1">
            <Label>Start date <DateHint /></Label>
            <Input className="h-9 w-36" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>End date <DateHint /></Label>
            <Input className="h-9 w-36" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {(sites ?? [])
                  .filter((s: any) => s.facilityType === "warehouse")
                  .map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="relief_item">Relief item</SelectItem>
                <SelectItem value="medical_supply">Medical supply</SelectItem>
                <SelectItem value="shelter_material">Shelter material</SelectItem>
              </SelectContent>
            </Select>
          </div>
                  </>
        }
        end={
          <ExportMenu
            testId="report-export-menu"
            formats={[
              {
                id: "csv",
                label: "Export CSV",
                onSelect: () => downloadCsv(tableRows as any[], `report-${selectedReport}.csv`),
              },
              {
                id: "pdf",
                label: "Print",
                onSelect: () => window.print(),
              },
            ]}
          />
        }
      />

      <Accordion type="multiple" className="space-y-3">
        {categories.map((categoryGroup) => (
          <AccordionItem
            key={categoryGroup.key}
            value={categoryGroup.key}
            data-testid={`report-category-${categoryGroup.key}`}
            className="rounded-md border px-4"
          >
            <AccordionTrigger>{categoryGroup.title}</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {categoryGroup.reports.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    data-testid={`report-card-${r.id}`}
                    aria-pressed={selectedReport === r.id}
                    onClick={() => setSelectedReport(r.id)}
                    className={`rounded-xl border bg-card p-4 text-left text-base font-semibold transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selectedReport === r.id ? "border-primary" : ""
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Card>
        <CardHeader>
          <CardTitle>
            {categories.flatMap((c) => c.reports).find((r) => r.id === selectedReport)?.label ?? selectedReport}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedReport === "vedAnalysis" && (
            <div data-testid="ved-chart" className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={vedAnalysis ?? []} dataKey="value" nameKey="ved" outerRadius={120} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {selectedReport === "abcAnalysis" && (
            <div data-testid="abc-chart" className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={abcRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="itemCode" hide />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="cumulativePercent" stroke="var(--chart-inbound)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {selectedReport === "fnsAnalysis" && (
            <div data-testid="fns-chart" className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fnsRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="itemCode" hide />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--chart-neutral)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {selectedReport === "forecastDemand" && (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="itemCode" hide />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="rolling3MonthAverage" stroke="var(--chart-inbound)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {selectedReport === "warehouseUtilization" && (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={warehouseRows}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="warehouseName" />
                  <PolarRadiusAxis />
                  <Radar dataKey="stockAccuracy" stroke="var(--chart-inbound)" fill="var(--chart-inbound)" fillOpacity={0.2} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {Object.keys((tableRows[0] as any) ?? { info: "" }).map((k) => (
                    <th key={k} className="px-2 py-2 text-left font-medium">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(0, 30).map((row: any, idx: number) => (
                  <tr key={idx} className="border-t">
                    {Object.keys((tableRows[0] as any) ?? { info: "" }).map((k) => (
                      <td key={k} className="px-2 py-2">
                        {typeof row[k] === "object" ? JSON.stringify(row[k]) : String(row[k] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
