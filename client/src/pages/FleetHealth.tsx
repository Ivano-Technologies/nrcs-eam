import { ManagerFinanceGate } from "@/components/finance/ManagerFinanceGate";
import { KpiCard } from "@/components/dashboard/KpiCard";
import PageHeader from "@/components/ui/PageHeader";
import PageLoader from "@/components/ui/PageLoader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { downloadBase64File } from "@/lib/download";
import { formatNaira } from "@/lib/format";
import { KPI_VALUE_CLASS } from "@/lib/kpiTypography";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Banknote, FileDown, Loader2, ShieldCheck, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function FleetHealth() {
  const [siteId, setSiteId] = useState<string>("all");
  const queryInput = useMemo(
    () => (siteId !== "all" ? { siteId: parseInt(siteId, 10) } : undefined),
    [siteId]
  );

  const { data, isLoading } = trpc.fleetHealth.summary.useQuery(queryInput);
  const { data: sites } = trpc.sites.list.useQuery();
  const exportPdf = trpc.fleetHealth.exportPdf.useMutation({
    onSuccess: (r) => {
      downloadBase64File(r.data, r.filename, r.mimeType);
      toast.success("Fleet health report downloaded");
    },
    onError: (e) => toast.error(e.message),
  });
  const autoWo = trpc.maintenance.autoCreateWorkOrders.useMutation({
    onSuccess: (r) => toast.success(`Created ${r.created} preventive work order(s)`),
    onError: (e) => toast.error(e.message),
  });

  const row = useMemo(() => {
    if (!data) return null;
    if (siteId === "all") return data.orgWide;
    return data.bySite.find((s) => String(s.siteId) === siteId) ?? data.orgWide;
  }, [data, siteId]);

  const overdueWo = row
    ? row.openWorkOrdersByAge.days15to30 + row.openWorkOrdersByAge.days30plus
    : 0;

  if (isLoading) return <PageLoader />;

  return (
    <ManagerFinanceGate>
      <div className="container mx-auto space-y-6 p-4 md:p-6" data-testid="fleet-health-page">
        <PageHeader
          title="Fleet health"
          subtitle="Depreciation, maintenance predictions, and operational alerts for HQ weekly review."
          icon={ShieldCheck}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Select value={siteId} onValueChange={setSiteId}>
            <SelectTrigger className="w-[220px]" data-testid="fleet-health-site-filter">
              <SelectValue placeholder="All sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Organisation-wide</SelectItem>
              {(sites ?? []).map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={exportPdf.isPending}
            onClick={() => exportPdf.mutate(queryInput)}
          >
            {exportPdf.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Export PDF
          </Button>
        </div>

        {row && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Total book value"
                value={formatNaira(row.totalBookValue)}
                icon={Banknote}
                tone="blue"
                data-testid="fleet-kpi-book-value"
              />
              <KpiCard
                label="End-of-life pipeline"
                value={String(row.endOfLifeCount)}
                icon={AlertTriangle}
                tone={row.endOfLifeCount > 0 ? "orange" : "green"}
                data-testid="fleet-kpi-eol"
              />
              <KpiCard
                label="High-priority predictions"
                value={String(row.highPriorityPredictions.length)}
                icon={ShieldCheck}
                tone={row.highPriorityPredictions.length > 0 ? "orange" : "green"}
                data-testid="fleet-kpi-predictions"
              />
              <KpiCard
                label="Overdue work orders"
                value={String(overdueWo)}
                icon={Wrench}
                tone={overdueWo > 0 ? "red" : "green"}
                data-testid="fleet-kpi-overdue-wo"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Replacement pipeline</CardTitle>
                <CardDescription>Assets past 80% of estimated useful life</CardDescription>
              </CardHeader>
              <CardContent>
                {row.replacementPipeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assets in replacement pipeline.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Life used</TableHead>
                        <TableHead className="text-right">Book value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {row.replacementPipeline.slice(0, 25).map((a) => (
                        <TableRow key={a.assetId}>
                          <TableCell>
                            <div className="font-medium">{a.assetName}</div>
                            <div className="text-xs text-muted-foreground">{a.assetTag}</div>
                          </TableCell>
                          <TableCell>{a.siteName}</TableCell>
                          <TableCell>{a.category}</TableCell>
                          <TableCell>
                            {a.yearsElapsed}y / {a.usefulLifeYears}y ({a.lifePercentUsed}%)
                          </TableCell>
                          <TableCell className={`text-right ${KPI_VALUE_CLASS}`}>
                            {formatNaira(a.currentBookValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Maintenance predictions
                  </CardTitle>
                  <CardDescription>High and critical priority — create preventive work orders</CardDescription>
                </div>
                <Button
                  size="sm"
                  disabled={autoWo.isPending || row.highPriorityPredictions.length === 0}
                  onClick={() => autoWo.mutate()}
                  data-testid="fleet-auto-create-wo"
                >
                  {autoWo.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Auto-create work orders
                </Button>
              </CardHeader>
              <CardContent>
                {row.highPriorityPredictions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No high-priority predictions.</p>
                ) : (
                  <ul className="space-y-3">
                    {row.highPriorityPredictions.map((p) => (
                      <li
                        key={p.assetId}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3"
                      >
                        <div>
                          <div className="font-medium">
                            {p.assetName}{" "}
                            <span className="text-muted-foreground">({p.assetTag})</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{p.reason}</p>
                          <p className="text-xs text-muted-foreground mt-1">{p.recommendedAction}</p>
                        </div>
                        <Badge variant={p.priority === "critical" ? "destructive" : "default"}>
                          {p.priority} · {p.predictedFailureDate}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Open work orders by age
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {(
                  [
                    ["0–7 days", row.openWorkOrdersByAge.days0to7],
                    ["8–14 days", row.openWorkOrdersByAge.days8to14],
                    ["15–30 days", row.openWorkOrdersByAge.days15to30],
                    ["30+ days", row.openWorkOrdersByAge.days30plus],
                  ] as const
                ).map(([label, count]) => (
                  <div key={label} className="rounded-md border p-3 text-center">
                    <div className={KPI_VALUE_CLASS}>{count}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ManagerFinanceGate>
  );
}
