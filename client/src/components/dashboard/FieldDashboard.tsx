import type { DashboardBundle } from "@/components/dashboard/DashboardBundleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPI_VALUE_CLASS } from "@/lib/kpiTypography";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { appPath } from "@/lib/routes";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Loader2, PackagePlus } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  branch_approved: "Branch approved",
  hq_approved: "HQ approved",
  rejected: "Rejected",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

type FieldDashboardProps = {
  metrics?: DashboardBundle["metrics"];
};

export function FieldDashboard({ metrics: metricsProp }: FieldDashboardProps) {
  const { data: fetchedMetrics, isLoading: metricsLoading } = trpc.dashboard.metrics.useQuery(
    { period: "Month" },
    { enabled: metricsProp === undefined, staleTime: 60_000 }
  );
  const metrics = metricsProp ?? fetchedMetrics;
  const { data: myReqs, isLoading: reqsLoading } = trpc.inventoryV2.requisitions.listMine.useQuery({ limit: 15 });

  const total = metrics?.stockReadiness?.total ?? 0;
  const adequate = metrics?.stockReadiness?.adequate ?? 0;
  const pct = total > 0 ? Math.round((adequate / total) * 100) : 0;

  if (metricsLoading && metrics === undefined) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20 shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl">My Branch Stock Status</CardTitle>
          <CardDescription>Readiness for your assigned facility (warehouse stock cards)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className={cn(KPI_VALUE_CLASS, "text-primary")}>{pct}%</div>
            <p className="text-muted-foreground pb-1">
              {adequate} of {total} readiness buckets adequately stocked
            </p>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg" className="gap-2">
          <Link href={`${appPath("/inventory/requisitions")}?new=1`}>
            <PackagePlus className="h-5 w-5" />
            New Requisition
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Pending Requisitions</CardTitle>
          <CardDescription>Requests you submitted and their approval status</CardDescription>
        </CardHeader>
        <CardContent>
          {reqsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading…</span>
            </div>
          ) : !myReqs?.length ? (
            <p className="text-sm text-muted-foreground">No requisitions yet.</p>
          ) : (
            <ul className="space-y-3">
              {myReqs.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{r.reqNumber}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">{r.title}</p>
                  </div>
                  <Badge variant="secondary">{STATUS_LABEL[r.status ?? ""] ?? r.status ?? "—"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
