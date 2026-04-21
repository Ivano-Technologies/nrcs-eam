import { useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Download } from "lucide-react";
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
    title: "Stock Reports",
    reports: [
      { id: "stockStatus", label: "Current Stock Status" },
      { id: "warehouseUtilization", label: "Warehouse Performance" },
      { id: "forecastDemand", label: "Demand Forecast" },
    ],
  },
  {
    key: "movement",
    title: "Movement Reports",
    reports: [
      { id: "stockMovement", label: "Movement Analysis" },
      { id: "abcAnalysis", label: "ABC Analysis" },
      { id: "fnsAnalysis", label: "FNS Analysis" },
    ],
  },
  {
    key: "expiry",
    title: "Expiry Reports",
    reports: [
      { id: "expiryForecast", label: "Expiry Forecast" },
      { id: "vedAnalysis", label: "VED Analysis" },
    ],
  },
  {
    key: "distribution",
    title: "Distribution Reports",
    reports: [{ id: "distributionSummary", label: "Distribution Summary" }],
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
  const [selectedReport, setSelectedReport] = useState("stockStatus");
  const [warehouseId, setWarehouseId] = useState("all");
  const [category, setCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: sites } = trpc.sites.list.useQuery();
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

  const tableRows = useMemo(() => {
    switch (selectedReport) {
      case "stockStatus":
        return stockStatus ?? [];
      case "stockMovement":
        return stockMovement?.fastMovingItems ?? [];
      case "expiryForecast":
        return expiryForecast?.highestRiskItems ?? [];
      case "distributionSummary":
        return distributionSummary?.distributionsByLocation ?? [];
      case "vedAnalysis":
        return vedAnalysis ?? [];
      case "abcAnalysis":
        return abcAnalysis ?? [];
      case "fnsAnalysis":
        return fnsAnalysis ?? [];
      case "warehouseUtilization":
        return warehouseUtilization ?? [];
      case "forecastDemand":
        return forecastDemand ?? [];
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
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">
          Inventory intelligence, VED/ABC/FNS analysis, and forecasting.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Date range, warehouse, and category filters</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>End date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="w-[220px]">
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
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="relief_item">Relief Item</SelectItem>
                <SelectItem value="medical_supply">Medical Supply</SelectItem>
                <SelectItem value="shelter_material">Shelter Material</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            data-testid="report-download-csv-btn"
            onClick={() => downloadCsv(tableRows as any[], `report-${selectedReport}.csv`)}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" data-testid="report-download-excel-btn" onClick={() => downloadCsv(tableRows as any[], `report-${selectedReport}.xlsx.csv`)}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          <Button variant="outline" data-testid="report-download-pdf-btn" onClick={() => window.print()}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </CardContent>
      </Card>

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
                  <Card
                    key={r.id}
                    data-testid={`report-card-${r.id}`}
                    className={selectedReport === r.id ? "border-primary" : ""}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{r.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button variant="secondary" size="sm" onClick={() => setSelectedReport(r.id)}>
                        Open
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Card>
        <CardHeader>
          <CardTitle>{selectedReport}</CardTitle>
          <CardDescription>Chart + table view for selected report</CardDescription>
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
                <LineChart data={abcAnalysis ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="itemCode" hide />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="cumulativePercent" stroke="#DC2626" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {selectedReport === "fnsAnalysis" && (
            <div data-testid="fns-chart" className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fnsAnalysis ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="itemCode" hide />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0A1628" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {selectedReport === "forecastDemand" && (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastDemand ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="itemCode" hide />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="rolling3MonthAverage" stroke="#DC2626" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {selectedReport === "warehouseUtilization" && (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={warehouseUtilization ?? []}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="warehouseName" />
                  <PolarRadiusAxis />
                  <Radar dataKey="stockAccuracy" stroke="#DC2626" fill="#DC2626" fillOpacity={0.2} />
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
                        {typeof row[k] === "object" ? JSON.stringify(row[k]) : String(row[k] ?? "—")}
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
