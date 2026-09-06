import {
  dashboardSectionState,
  useDashboardBundle,
  useDashboardRetry,
} from "@/components/dashboard/DashboardBundleContext";
import { DashboardSectionError } from "@/components/dashboard/DashboardSectionError";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const KIND_DOT: Record<string, string> = {
  grn: "bg-green-500",
  waybill: "bg-red-500",
  requisition: "bg-amber-500",
  asset: "bg-blue-500",
  asset_transfer: "bg-purple-500",
};

export function ActivityFeed() {
  const bundle = useDashboardBundle();
  const onRetry = useDashboardRetry();
  const sectionState = dashboardSectionState(bundle, "recentActivity");
  const { data: fetched } = trpc.dashboard.recentActivity.useQuery(
    { limit: 5 },
    { enabled: bundle === undefined, staleTime: 60_000 }
  );
  const data = bundle?.recentActivity ?? fetched;

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="dashboard-section-title">Recent activity</CardTitle>
        <CardDescription className="text-[#334155] dark:text-[hsl(0_0%_95%)]">Latest operational events</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sectionState !== "ok" ? <DashboardSectionError onRetry={onRetry} /> : null}
        {sectionState === "ok" && (data ?? []).length === 0 ? <p className="text-sm text-[#334155] dark:text-[hsl(0_0%_95%)]">No recent activity yet.</p> : null}
        {sectionState === "ok" ? (data ?? []).map((item, idx) => {
          const prevFacility = idx > 0 ? (data ?? [])[idx - 1]?.facilityName : undefined;
          const showFacility = Boolean(item.facilityName) && item.facilityName !== prevFacility;
          return (
            <div key={`${item.timestamp}-${idx}`} className="flex items-center gap-3">
              <span className="w-24 shrink-0 whitespace-nowrap font-mono text-xs text-[#334155] dark:text-[hsl(0_0%_95%)]">
                {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
              </span>
              <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", KIND_DOT[item.type] ?? KIND_DOT.requisition)} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.description}</p>
                {showFacility ? (
                  <p className="text-xs text-[#334155] dark:text-[hsl(0_0%_95%)]">{item.facilityName}</p>
                ) : null}
              </div>
            </div>
          );
        }) : null}
      </CardContent>
    </Card>
  );
}
