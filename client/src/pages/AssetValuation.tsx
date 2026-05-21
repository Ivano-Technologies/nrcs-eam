import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadBase64File } from "@/lib/download";
import { formatNaira, formatNairaSummaryCard } from "@/lib/format";
import { KPI_VALUE_CLASS } from "@/lib/kpiTypography";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/ui/PageHeader";
import PageLoader from "@/components/ui/PageLoader";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowDown, ArrowUp, Download, FileSpreadsheet, Loader2, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type SortKey = "state" | "code" | "name" | "land" | "market" | "certified" | "date";
type PendingSortKey = "state" | "code";
type SortDir = "asc" | "desc";

const PENDING_PAGE_SIZE = 10;

function SummaryMetricCard({
  label,
  amount,
  value,
  subtext,
}: {
  label: string;
  amount?: number;
  value?: string | number;
  subtext?: string;
}) {
  const amountFmt = amount != null ? formatNairaSummaryCard(amount) : null;
  const showTooltip = amountFmt != null && amountFmt.display !== amountFmt.full;

  const valueClass = cn("mt-1 break-words", KPI_VALUE_CLASS);

  return (
    <Card className="h-full min-w-0 overflow-hidden">
      <CardContent className="flex min-h-[120px] min-w-0 flex-col justify-between p-4">
        <div className="h-8">
          <p className="line-clamp-2 text-xs leading-tight text-muted-foreground">{label}</p>
        </div>
        {amountFmt ? (
            showTooltip ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className={valueClass} title={amountFmt.full}>
                    {amountFmt.display}
                  </p>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{amountFmt.full}</TooltipContent>
              </Tooltip>
            ) : (
              <p className={valueClass} title={amountFmt.full}>
                {amountFmt.display}
              </p>
            )
          ) : (
            <p className={valueClass}>{value}</p>
          )}
        <div className="mt-2 h-4">
          {subtext ? <p className="text-xs text-muted-foreground">{subtext}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="inline-block w-4" />;
  return dir === "asc" ? (
    <ArrowUp className="inline h-3.5 w-3.5" aria-hidden />
  ) : (
    <ArrowDown className="inline h-3.5 w-3.5" aria-hidden />
  );
}

export default function AssetValuation() {
  const { user } = useAuth();
  const allowed = user?.role === "admin" || user?.role === "manager";

  const reportQuery = trpc.assetValuation.report.useQuery(undefined, {
    enabled: allowed,
    staleTime: 60_000,
  });

  const pdfMutation = trpc.assetValuation.exportExecutivePdf.useMutation({
    onSuccess: (data) => {
      if (!data.base64?.length) {
        toast.error("PDF export returned empty data");
        return;
      }
      downloadBase64File(data.base64, data.filename, data.mimeType);
      toast.success("Executive summary PDF downloaded");
    },
    onError: (e) => toast.error(e.message || "PDF export failed"),
  });

  const excelMutation = trpc.assetValuation.exportRegisterExcel.useMutation({
    onSuccess: (data) => {
      if (!data.base64?.length) {
        toast.error("Excel export returned empty data");
        return;
      }
      downloadBase64File(data.base64, data.filename, data.mimeType);
      toast.success("Valuation register downloaded");
    },
    onError: (e) => toast.error(e.message || "Excel export failed"),
  });

  const [sortKey, setSortKey] = useState<SortKey>("state");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pendingSortKey, setPendingSortKey] = useState<PendingSortKey>("state");
  const [pendingSortDir, setPendingSortDir] = useState<SortDir>("asc");
  const [pendingPage, setPendingPage] = useState(1);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "certified" || key === "market" || key === "land" ? "desc" : "asc");
    }
  };

  const togglePendingSort = (key: PendingSortKey) => {
    if (pendingSortKey === key) {
      setPendingSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setPendingSortKey(key);
      setPendingSortDir("asc");
    }
  };

  const groupedRegister = useMemo(() => {
    const rows = reportQuery.data?.propertyRegister ?? [];
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: (typeof rows)[0], b: (typeof rows)[0]): number => {
      switch (sortKey) {
        case "state":
          return dir * String(a.state ?? "").localeCompare(String(b.state ?? ""));
        case "code":
          return dir * String(a.facilityCode ?? "").localeCompare(String(b.facilityCode ?? ""));
        case "name":
          return dir * a.facilityName.localeCompare(b.facilityName);
        case "land":
          return dir * ((Number(a.landAreaSqm) || 0) - (Number(b.landAreaSqm) || 0));
        case "market":
          return dir * (a.marketValueNgn - b.marketValueNgn);
        case "certified":
          return dir * (a.certifiedValueNgn - b.certifiedValueNgn);
        case "date":
          return dir * String(a.valuationDate).localeCompare(String(b.valuationDate));
        default:
          return 0;
      }
    };

    const byState = new Map<string, typeof rows>();
    for (const r of rows) {
      const st = r.state ?? "—";
      if (!byState.has(st)) byState.set(st, []);
      byState.get(st)!.push(r);
    }
    const states = Array.from(byState.keys()).sort((a, b) => a.localeCompare(b));
    for (const st of states) {
      const bucket = byState.get(st)!;
      bucket.sort(cmp);
    }
    return { byState, states };
  }, [reportQuery.data?.propertyRegister, sortKey, sortDir]);

  const pendingBranches = reportQuery.data?.pendingBranchValuation ?? [];

  const sortedPendingBranches = useMemo(() => {
    const rows = [...pendingBranches];
    const dir = pendingSortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (pendingSortKey === "state") {
        return dir * String(a.state ?? "").localeCompare(String(b.state ?? ""));
      }
      return dir * String(a.facilityCode ?? "").localeCompare(String(b.facilityCode ?? ""));
    });
    return rows;
  }, [pendingBranches, pendingSortKey, pendingSortDir]);

  const pendingTotalPages = Math.max(1, Math.ceil(sortedPendingBranches.length / PENDING_PAGE_SIZE));

  useEffect(() => {
    setPendingPage(1);
  }, [pendingSortKey, pendingSortDir, pendingBranches.length]);

  useEffect(() => {
    if (pendingPage > pendingTotalPages) {
      setPendingPage(pendingTotalPages);
    }
  }, [pendingPage, pendingTotalPages]);

  const pendingPageRows = useMemo(() => {
    const start = (pendingPage - 1) * PENDING_PAGE_SIZE;
    return sortedPendingBranches.slice(start, start + PENDING_PAGE_SIZE);
  }, [sortedPendingBranches, pendingPage]);

  if (!allowed) {
    return (
      <div className="container mx-auto max-w-lg space-y-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" aria-hidden />
              Access restricted
            </CardTitle>
            <CardDescription>Asset Valuation is available to managers and administrators only.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (reportQuery.isLoading) return <PageLoader />;

  if (reportQuery.isError || !reportQuery.data) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Could not load valuation data</CardTitle>
            <CardDescription>Try again later or contact support.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const r = reportQuery.data;
  const movableCount = r.movableByCategory.reduce((s, x) => s + x.count, 0);

  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          icon={TrendingUp}
          title="Asset Valuation"
          subtitle="Comprehensive asset valuation and reporting for properties, movable assets, and executive financial reviews."
          className="mb-0"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={excelMutation.isPending}
            onClick={() => excelMutation.mutate()}
          >
            {excelMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export to Excel
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pdfMutation.isPending}
            onClick={() => pdfMutation.mutate()}
          >
            {pdfMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export to PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Section 1 — Summary */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Summary</h2>
        <div className="grid min-w-0 grid-cols-2 items-stretch gap-4 md:grid-cols-3 lg:grid-cols-5">
          <SummaryMetricCard
            label="Total certified property value"
            amount={r.totalCertifiedPropertyNgn}
          />
          <SummaryMetricCard
            label="Total movable asset value (acquisition)"
            amount={r.totalMovableAcquisitionNgn}
          />
          <SummaryMetricCard label="Combined total asset value" amount={r.combinedTotalNgn} />
          <SummaryMetricCard
            label="Valued properties (register)"
            value={r.valuationRowCount}
            subtext={`${r.distinctSitesWithValuation} sites · ${r.totalFacilityCount} facilities total`}
          />
          <SummaryMetricCard
            label="Branch offices pending valuation"
            value={pendingBranches.length}
            subtext={`of ${r.activeBranchCount} active branches`}
          />
        </div>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Branches not yet valued (property register)</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Active branch offices with no property valuation row on the branch site itself. The{" "}
              {r.valuationRowCount} register entries include divisions, warehouses, and clinics — not every
              entry maps to a branch code (e.g. ABI-002 vs ABI-001). Coordinate with branch secretaries to
              commission branch-level valuations.
              {pendingBranches.length > 0
                ? ` ${pendingBranches.length} of ${r.activeBranchCount} active branch offices pending.`
                : " All active branches have a valuation on the branch site."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {pendingBranches.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">—</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">S/No</TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-medium hover:underline"
                            onClick={() => togglePendingSort("code")}
                          >
                            Facility code
                            <SortIcon active={pendingSortKey === "code"} dir={pendingSortDir} />
                          </button>
                        </TableHead>
                        <TableHead>Branch name</TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-medium hover:underline"
                            onClick={() => togglePendingSort("state")}
                          >
                            State
                            <SortIcon active={pendingSortKey === "state"} dir={pendingSortDir} />
                          </button>
                        </TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingPageRows.map((b, idx) => (
                        <TableRow
                          key={b.siteId}
                          className={idx % 2 === 1 ? "bg-muted/30" : undefined}
                        >
                          <TableCell className="tabular-nums text-muted-foreground">
                            {(pendingPage - 1) * PENDING_PAGE_SIZE + idx + 1}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{b.facilityCode ?? "—"}</TableCell>
                          <TableCell>{b.facilityName}</TableCell>
                          <TableCell>{b.state ?? "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
                            >
                              Pending Valuation
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {sortedPendingBranches.length > PENDING_PAGE_SIZE ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      Showing {(pendingPage - 1) * PENDING_PAGE_SIZE + 1}–
                      {Math.min(pendingPage * PENDING_PAGE_SIZE, sortedPendingBranches.length)} of{" "}
                      {sortedPendingBranches.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pendingPage <= 1}
                        onClick={() => setPendingPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <span className="text-sm tabular-nums">
                        Page {pendingPage} of {pendingTotalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pendingPage >= pendingTotalPages}
                        onClick={() => setPendingPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Section 2 — Register */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Property valuation register</h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        onClick={() => toggleSort("state")}
                      >
                        State
                        <SortIcon active={sortKey === "state"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        onClick={() => toggleSort("code")}
                      >
                        Facility code
                        <SortIcon active={sortKey === "code"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        onClick={() => toggleSort("name")}
                      >
                        Facility name
                        <SortIcon active={sortKey === "name"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        onClick={() => toggleSort("land")}
                      >
                        Land (sqm)
                        <SortIcon active={sortKey === "land"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        onClick={() => toggleSort("market")}
                      >
                        Market (₦)
                        <SortIcon active={sortKey === "market"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        onClick={() => toggleSort("certified")}
                      >
                        Certified (₦)
                        <SortIcon active={sortKey === "certified"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        onClick={() => toggleSort("date")}
                      >
                        Valuation date
                        <SortIcon active={sortKey === "date"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedRegister.states.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No property valuations in the database yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedRegister.states.flatMap((state) => {
                      const blockRows = groupedRegister.byState.get(state) ?? [];
                      return [
                        <TableRow key={`hdr-${state}`} className="bg-muted/60 hover:bg-muted/60">
                          <TableCell colSpan={8} className="py-2 text-xs font-semibold uppercase tracking-wide">
                            {state}
                          </TableCell>
                        </TableRow>,
                        ...blockRows.map((row) => (
                          <TableRow key={`${row.valuationId}-${row.facilityCode}`}>
                            <TableCell className="text-muted-foreground">{row.state ?? "—"}</TableCell>
                            <TableCell className="font-mono text-sm">{row.facilityCode ?? "—"}</TableCell>
                            <TableCell>
                              {row.facilityName}
                              {row.notes ? (
                                <span className="mt-0.5 block text-xs text-muted-foreground">{row.notes}</span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.landAreaSqm != null
                                ? Number(row.landAreaSqm).toLocaleString("en-NG", { maximumFractionDigits: 2 })
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNaira(row.marketValueNgn)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatNaira(row.certifiedValueNgn)}
                            </TableCell>
                            <TableCell className="tabular-nums text-sm">{row.valuationDate}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                              {row.valuationReference ?? "—"}
                            </TableCell>
                          </TableRow>
                        )),
                      ];
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h3 className="text-base font-semibold">Pending valuation — all facilities</h3>
          <Card>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Facility code</TableHead>
                      <TableHead>Facility name</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.pendingValuation.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No pending rows — every facility has a valuation entry.
                        </TableCell>
                      </TableRow>
                    ) : (
                      r.pendingValuation.map((p) => (
                        <TableRow key={p.siteId}>
                          <TableCell className="font-mono text-sm">{p.facilityCode ?? "—"}</TableCell>
                          <TableCell>{p.facilityName}</TableCell>
                          <TableCell>{p.state ?? "—"}</TableCell>
                          <TableCell className="capitalize">{p.facilityType}</TableCell>
                          <TableCell>Not yet valued</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 3 — Movable */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Movable asset summary</h2>
        <p className="text-sm text-muted-foreground">
          Acquisition and depreciated totals by register category (excludes land LA / building LB codes; value sits in
          the property register). {movableCount} line items in view.
        </p>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Total acquisition (₦)</TableHead>
                  <TableHead className="text-right">Total depreciated (₦)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.movableByCategory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No movable register rows with acquisition value.
                    </TableCell>
                  </TableRow>
                ) : (
                  r.movableByCategory.map((m) => (
                    <TableRow key={m.categoryName}>
                      <TableCell>{m.categoryName}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(m.totalAcquisitionNgn)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(m.totalDepreciatedNgn)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
