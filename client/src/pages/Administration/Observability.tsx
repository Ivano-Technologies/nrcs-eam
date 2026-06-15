import { useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Activity, BarChart3, Database, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function msBadgeClass(ms: number, timedOut: boolean): string {
  if (timedOut) return "border-red-500/50 bg-red-500/10 text-red-800 dark:text-red-200";
  if (ms < 2000) return "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  if (ms < 4000) return "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200";
  return "border-red-500/50 bg-red-500/10 text-red-800 dark:text-red-200";
}

function hitRateClass(rate: number): string {
  if (rate >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function redisStatusBadge(status: "connected" | "error" | "fallback" | undefined): {
  label: string;
  className: string;
} {
  switch (status) {
    case "connected":
      return {
        label: "Redis: Connected",
        className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
      };
    case "error":
      return {
        label: "Redis: Error",
        className: "border-red-500/50 bg-red-500/10 text-red-800 dark:text-red-200",
      };
    default:
      return {
        label: "Redis: In-memory fallback",
        className: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200",
      };
  }
}

export default function Observability() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const pool = trpc.admin.observability.poolStatus.useQuery(undefined, {
    refetchInterval: 500,
  });
  const cache = trpc.admin.observability.cacheMetrics.useQuery(undefined, {
    refetchInterval: 500,
  });
  const dashboard = trpc.admin.observability.dashboardRequests.useQuery(
    { limit: 10 },
    { refetchInterval: 500 }
  );
  const database = trpc.admin.observability.databaseMetrics.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const lastUpdated = useMemo(() => new Date().toLocaleTimeString(), [
    pool.dataUpdatedAt,
    cache.dataUpdatedAt,
    dashboard.dataUpdatedAt,
  ]);

  if (user?.role !== "admin") {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <p className="text-xl text-muted-foreground">Admin access required</p>
      </div>
    );
  }

  const poolRunning = pool.data?.queueRunning ?? 0;
  const poolMax = pool.data?.maxConcurrent ?? 3;
  const poolPct = Math.round((poolRunning / poolMax) * 100);
  const hitRate = cache.data?.hitRatePct ?? 0;
  const redisBadge = redisStatusBadge(pool.data?.redisStatus);

  const refreshAll = () => {
    void utils.admin.observability.poolStatus.invalidate();
    void utils.admin.observability.cacheMetrics.invalidate();
    void utils.admin.observability.dashboardRequests.invalidate();
    void utils.admin.observability.databaseMetrics.invalidate();
  };

  return (
    <div className="space-y-6" data-testid="admin-observability-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          icon={BarChart3}
          title="System Observability"
          subtitle="Real-time pool, cache, and dashboard performance"
          className="mb-0"
        />
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Updated {lastUpdated}</span>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Connection Pool & Cache
            </CardTitle>
            <CardDescription>Polls every 500ms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span>Queue concurrency</span>
                <span className={cn(poolRunning >= poolMax && "font-semibold text-red-600")}>
                  {poolRunning}/{poolMax}
                </span>
              </div>
              <Progress
                value={poolPct}
                className={cn(poolRunning >= poolMax && "[&>div]:bg-red-500")}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {pool.data?.queueQueued ?? 0} tasks waiting · {pool.data?.poolDescription}
              </p>
            </div>

            <div>
              <Badge variant="outline" className={redisBadge.className}>
                {redisBadge.label}
              </Badge>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Cache hit rate (24h)</p>
              <p className={cn("text-2xl font-semibold", hitRateClass(hitRate))}>
                {hitRate}%
              </p>
              <p className="text-xs text-muted-foreground">
                {cache.data?.hits ?? 0} hits / {cache.data?.misses ?? 0} misses (
                {cache.data?.totalGets ?? 0} total)
              </p>
              {hitRate < 50 ? (
                <Badge variant="outline" className="mt-2 border-red-500/50 text-red-700">
                  Below 50% target
                </Badge>
              ) : null}
            </div>

            <div className="space-y-1 text-xs">
              {cache.data?.byPrefix
                ? Object.entries(cache.data.byPrefix)
                    .filter(([, v]) => v.hits + v.misses > 0)
                    .map(([prefix, v]) => (
                      <div key={prefix} className="flex justify-between">
                        <span className="text-muted-foreground">{prefix}</span>
                        <span>{v.hitRatePct}%</span>
                      </div>
                    ))
                : null}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Last 10 Dashboard Loads</CardTitle>
            <CardDescription>Wall-clock and tier breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Avg: {dashboard.data?.avgWallClockMs ?? 0} ms</span>
              <span>p95: {dashboard.data?.p95Ms ?? 0} ms</span>
              <span>p99: {dashboard.data?.p99Ms ?? 0} ms</span>
              <span>Timeouts: {dashboard.data?.timeoutRatePct ?? 0}%</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ms</TableHead>
                  <TableHead>T1</TableHead>
                  <TableHead>T2</TableHead>
                  <TableHead>T3</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dashboard.data?.last10 ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No dashboard requests recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  dashboard.data?.last10.map((row, i) => {
                    const timedOut = row.timedOutSections.length > 0;
                    return (
                      <TableRow key={`${row.timestamp}-${i}`}>
                        <TableCell>
                          <Badge variant="outline" className={msBadgeClass(row.wallClockMs, timedOut)}>
                            {row.wallClockMs}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{row.tier1Ms ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.tier2Ms ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.tier3Ms ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {timedOut ? "⚠️ timeout" : "✅"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              Database & Security
            </CardTitle>
            <CardDescription>Refreshes every 60s</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Top tables by size</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead className="text-right">MB</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(database.data?.topTables ?? []).map((t) => (
                    <TableRow key={t.name}>
                      <TableCell className="font-mono text-xs">
                        {t.name}
                        {t.name === "stock_movements" && t.sizeMb > 1024 ? (
                          <Badge variant="outline" className="ml-1 border-red-500/50 text-red-700">
                            &gt;1GB
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right text-xs">{t.rowCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs">{t.sizeMb}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Query p99 (buffer)</p>
                <p
                  className={cn(
                    "font-semibold",
                    (database.data?.queryLatencies.p99 ?? 0) > 2000 && "text-red-600"
                  )}
                >
                  {database.data?.queryLatencies.p99 ?? 0} ms
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Failed logins (24h)</p>
                <p className="font-semibold">{database.data?.failedLogins24h ?? 0}</p>
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm text-muted-foreground">Tier timeouts (24h)</p>
              <div className="flex gap-3 text-xs">
                <span>T1: {database.data?.tierTimeoutCounts24h.tier1 ?? 0}</span>
                <span>T2: {database.data?.tierTimeoutCounts24h.tier2 ?? 0}</span>
                <span>T3: {database.data?.tierTimeoutCounts24h.tier3 ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
