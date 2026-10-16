import { formatEnumLabel } from "@/lib/format";
import { Building2 } from "lucide-react";
import {
  dashboardSectionState,
  useDashboardBundle,
  useDashboardRetry,
} from "@/components/dashboard/DashboardBundleContext";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardSectionError } from "@/components/dashboard/DashboardSectionError";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function statusClass(status: "active" | "offline") {
  if (status === "active") return "bg-green-100 text-green-800";
  return "bg-slate-100 text-slate-700";
}

export function FacilityStatusList() {
  const bundle = useDashboardBundle();
  const onRetry = useDashboardRetry();
  const sectionState = dashboardSectionState(bundle, "facilityStatus");
  const { data: fetched } = trpc.dashboard.facilityStatus.useQuery(undefined, {
    enabled: bundle === undefined,
    staleTime: 60_000,
  });
  const data = bundle?.facilityStatus ?? fetched;
  const scoreToneClass = (score: number) => {
    if (score >= 70) return "bg-green-500";
    if (score >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="dashboard-section-title">Facility status</CardTitle>
        <CardDescription className="text-contrast dark:text-[hsl(0_0%_95%)]">Facility records from the live sites table</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sectionState !== "ok" ? <DashboardSectionError onRetry={onRetry} /> : null}
        {sectionState === "ok" && (data ?? []).length === 0 ? <EmptyState icon={Building2} title="No facilities yet" className="py-6" /> : null}
        {sectionState === "ok" ? (data ?? []).map((row) => (
          <div key={row.id} className="flex items-center gap-4 rounded-md border p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{row.name}</p>
              <p className="text-xs text-contrast dark:text-[hsl(0_0%_95%)]">
                {row.code ?? "No code"} · {row.type}
              </p>
              {row.stockScore !== null ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-all", scoreToneClass(row.stockScore))} style={{ width: `${row.stockScore}%` }} />
                  </div>
                  <span className="text-xs font-medium text-contrast dark:text-[hsl(0_0%_95%)]">{row.stockScore}%</span>
                </div>
              ) : (
                <p className="mt-2 text-xs text-contrast dark:text-[hsl(0_0%_95%)]">No stock data</p>
              )}
            </div>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", statusClass(row.status))}>{formatEnumLabel(row.status)}</span>
          </div>
        )) : null}
      </CardContent>
    </Card>
  );
}
