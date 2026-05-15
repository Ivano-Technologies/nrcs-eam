import { useAuth } from "@/_core/hooks/useAuth";
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
import { formatNaira } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowDown, ArrowUp, Download, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";

type SortKey = "state" | "code" | "name" | "land" | "market" | "certified" | "date";
type SortDir = "asc" | "desc";

function downloadBase64File(base64: string, filename: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
      downloadBase64File(data.base64, data.filename, data.mimeType);
    },
  });

  const excelMutation = trpc.assetValuation.exportRegisterExcel.useMutation({
    onSuccess: (data) => {
      downloadBase64File(data.base64, data.filename, data.mimeType);
    },
  });

  const [sortKey, setSortKey] = useState<SortKey>("state");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "certified" || key === "market" || key === "land" ? "desc" : "asc");
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

  if (reportQuery.isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-muted" />
          <div className="grid gap-3 md:grid-cols-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

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
  const pendingBranches = r.pendingBranchValuation;
  const movableCount = r.movableByCategory.reduce((s, x) => s + x.count, 0);

  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Asset Valuation</h1>
          <p className="text-muted-foreground">
            Property register, movable asset totals, and executive exports (Finance).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={excelMutation.isPending}
            onClick={() => excelMutation.mutate()}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pdfMutation.isPending}
            onClick={() => pdfMutation.mutate()}
          >
            <Download className="mr-2 h-4 w-4" />
            Export to PDF
          </Button>
        </div>
      </div>

      {/* Section 1 — Summary */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Summary</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total certified property value</CardDescription>
              <CardTitle className="text-xl tabular-nums">{formatNaira(r.totalCertifiedPropertyNgn)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total movable asset value (acquisition)</CardDescription>
              <CardTitle className="text-xl tabular-nums">{formatNaira(r.totalMovableAcquisitionNgn)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Combined total asset value</CardDescription>
              <CardTitle className="text-xl tabular-nums">{formatNaira(r.combinedTotalNgn)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Properties valued</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {r.distinctSitesWithValuation}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  of {r.totalFacilityCount} facilities
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branches not yet valued (property register)</CardTitle>
            <CardDescription>
              {pendingBranches.length === 0
                ? "All branches have at least one linked property valuation row."
                : `${pendingBranches.length} branch office${pendingBranches.length === 1 ? "" : "es"} pending formal land/building valuation.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingBranches.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="max-h-48 list-inside list-disc overflow-y-auto text-sm text-muted-foreground md:columns-2">
                {pendingBranches.map((b) => (
                  <li key={b.siteId}>
                    <span className="font-medium text-foreground">{b.state ?? "—"}</span>
                    {": "}
                    {b.facilityName}
                    {b.facilityCode ? ` (${b.facilityCode})` : ""}
                  </li>
                ))}
              </ul>
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
