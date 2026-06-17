import { ManagerFinanceGate } from "@/components/finance/ManagerFinanceGate";
import PageHeader from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNaira } from "@/lib/format";
import { KPI_VALUE_CLASS } from "@/lib/kpiTypography";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { FileSpreadsheet, Loader2, RefreshCw, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 25;

export default function DepreciationSchedule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [page, setPage] = useState(1);
  const [siteId, setSiteId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const { data: summary } = trpc.depreciationReport.summary.useQuery();
  const { data: schedule } = trpc.depreciationReport.schedule.useQuery({
    siteId: siteId !== "all" ? parseInt(siteId, 10) : undefined,
    status: status === "fully_depreciated" ? "fully_depreciated" : status === "active" ? "active" : undefined,
  });
  const { data: sites } = trpc.sites.list.useQuery(undefined);
  const utils = trpc.useUtils();

  const recalc = trpc.assets.recalculateDepreciation.useMutation({
    onSuccess: (r) => {
      toast.success(`Recalculated ${r.updated} assets`);
      void utils.depreciationReport.summary.invalidate();
      void utils.depreciationReport.schedule.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const exportExcel = trpc.depreciationReport.exportExcel.useMutation({
    onSuccess: (data) => {
      const a = document.createElement("a");
      a.href = `data:${data.mimeType};base64,${data.base64}`;
      a.download = data.filename;
      a.click();
    },
  });

  const pageRows = useMemo(() => {
    const rows = schedule ?? [];
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [schedule, page]);

  const totalPages = Math.max(1, Math.ceil((schedule?.length ?? 0) / PAGE_SIZE));

  return (
    <ManagerFinanceGate>
      <div className="container mx-auto space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            icon={TrendingDown}
            title="Depreciation Reporting"
            subtitle="Automated depreciation schedules and net book value reporting for organizational assets."
            className="mb-0"
          />
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <Button variant="outline" disabled={recalc.isPending} onClick={() => recalc.mutate()}>
                {recalc.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recalculating…
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Recalculate
                  </>
                )}
              </Button>
            ) : null}
            <Button variant="default" disabled={exportExcel.isPending} onClick={() => exportExcel.mutate({})}>
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
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total gross asset value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={KPI_VALUE_CLASS}>{formatNaira(summary?.totalGrossAssetValue ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Accumulated depreciation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={KPI_VALUE_CLASS}>{formatNaira(summary?.totalAccumulatedDepreciation ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Net book value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={KPI_VALUE_CLASS}>{formatNaira(summary?.totalNetBookValue ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Fully depreciated</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={KPI_VALUE_CLASS}>{summary?.assetsFullyDepreciated ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={siteId} onValueChange={(v) => { setSiteId(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Facility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All facilities</SelectItem>
              {(sites ?? []).map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="fully_depreciated">Fully depreciated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Acq. date</TableHead>
                  <TableHead className="text-right">Acq. cost</TableHead>
                  <TableHead className="text-right">Life (y)</TableHead>
                  <TableHead className="text-right">Annual dep.</TableHead>
                  <TableHead className="text-right">Accum. dep.</TableHead>
                  <TableHead className="text-right">NBV</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.assetId}>
                    <TableCell>{r.assetCode ?? "—"}</TableCell>
                    <TableCell>{r.assetName}</TableCell>
                    <TableCell>{r.categoryName}</TableCell>
                    <TableCell>{r.facilityName}</TableCell>
                    <TableCell>{r.acquisitionDate ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatNaira(r.acquisitionCostNgn)}</TableCell>
                    <TableCell className="text-right">{r.usefulLifeYears}</TableCell>
                    <TableCell className="text-right">{formatNaira(r.annualDepreciationNgn)}</TableCell>
                    <TableCell className="text-right">{formatNaira(r.accumulatedDepreciationNgn)}</TableCell>
                    <TableCell className="text-right">{formatNaira(r.netBookValueNgn)}</TableCell>
                    <TableCell className="text-right">
                      {r.fullyDepreciated ? <Badge variant="secondary">100%</Badge> : `${r.percentDepreciated}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </ManagerFinanceGate>
  );
}

