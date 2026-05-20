import { ManagerFinanceGate } from "@/components/finance/ManagerFinanceGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNaira } from "@/lib/format";
import { KPI_VALUE_CLASS } from "@/lib/kpiTypography";
import { trpc } from "@/lib/trpc";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AnnualFinanceReport() {
  const year = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(year);
  const [siteId, setSiteId] = useState<string>("all");

  const { data: sites } = trpc.sites.list.useQuery({ facilityType: "branch" });
  const { data: report, refetch, isFetching } = trpc.annualFinanceReport.getData.useQuery(
    {
      year: selectedYear,
      siteId: siteId !== "all" ? parseInt(siteId, 10) : undefined,
    },
    { enabled: false }
  );

  const exportPdf = trpc.annualFinanceReport.exportPdf.useMutation({
    onSuccess: (data) => {
      const a = document.createElement("a");
      a.href = `data:${data.mimeType};base64,${data.base64}`;
      a.download = data.filename;
      a.click();
    },
    onError: (e) => toast.error(e.message),
  });

  const exportExcel = trpc.annualFinanceReport.exportExcel.useMutation({
    onSuccess: (data) => {
      const a = document.createElement("a");
      a.href = `data:${data.mimeType};base64,${data.base64}`;
      a.download = data.filename;
      a.click();
    },
    onError: (e) => toast.error(e.message),
  });

  const load = () => void refetch();

  return (
    <ManagerFinanceGate>
      <div className="container mx-auto space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Annual Finance Report</h1>
          <p className="text-muted-foreground">Consolidated finance summary for board reporting</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Report parameters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Year</p>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v, 10))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[year, year - 1, year - 2].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Scope</p>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {(sites ?? []).map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={load} disabled={isFetching}>
              {isFetching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate report"
              )}
            </Button>
            {report ? (
              <>
                <Button
                  variant="outline"
                  disabled={exportPdf.isPending}
                  onClick={() =>
                    exportPdf.mutate({
                      year: selectedYear,
                      siteId: siteId !== "all" ? parseInt(siteId, 10) : undefined,
                    })
                  }
                >
                  {exportPdf.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting…
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Export PDF
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  disabled={exportExcel.isPending}
                  onClick={() =>
                    exportExcel.mutate({
                      year: selectedYear,
                      siteId: siteId !== "all" ? parseInt(siteId, 10) : undefined,
                    })
                  }
                >
                  {exportExcel.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting…
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Export Excel
                    </>
                  )}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>

        {report ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1. Asset valuation summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Property (certified): <span className={KPI_VALUE_CLASS}>{formatNaira(report.valuation.totalCertifiedPropertyNgn)}</span></p>
                <p>Movable (acquisition): <span className={KPI_VALUE_CLASS}>{formatNaira(report.valuation.totalMovableAcquisitionNgn)}</span></p>
                <p>Combined: <span className={KPI_VALUE_CLASS}>{formatNaira(report.valuation.combinedTotalNgn)}</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>2. Depreciation summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Gross: {formatNaira(report.depreciation.totalGrossAssetValue)}</p>
                <p>Accumulated: {formatNaira(report.depreciation.totalAccumulatedDepreciation)}</p>
                <p>Net book: {formatNaira(report.depreciation.totalNetBookValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>3. Budget vs actual</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {report.budgetVsActual.map((b) => (
                    <li key={b.siteId}>
                      {b.siteName}: {formatNaira(b.spend)} / {formatNaira(b.budget)} ({b.percentUsed}%)
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>4. Maintenance costs</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="mb-2">Total: {formatNaira(report.maintenance.totalSpend)}</p>
                <p className="font-medium">Top assets:</p>
                <ul className="list-disc pl-5">
                  {report.maintenance.topAssets.map((t, i) => (
                    <li key={i}>
                      {t.assetName} ({t.assetCode ?? "—"}): {formatNaira(t.total)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>5. Insurance summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Insured value: {formatNaira(report.insurance.totalInsuredValue)}</p>
                <p>Premiums: {formatNaira(report.insurance.totalAnnualPremiums)}</p>
                <p>Expiring in {report.year}: {report.insurance.policiesExpiringInYear}</p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </ManagerFinanceGate>
  );
}
