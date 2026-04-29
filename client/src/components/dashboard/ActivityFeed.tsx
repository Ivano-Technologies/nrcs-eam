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
  const { data } = trpc.dashboard.recentActivity.useQuery({ limit: 5 });

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="dashboard-section-title">Recent activity</CardTitle>
        <CardDescription className="text-[#334155] dark:text-[hsl(0_0%_95%)]">Latest operational events</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(data ?? []).length === 0 ? <p className="text-sm text-[#334155] dark:text-[hsl(0_0%_95%)]">No recent activity yet.</p> : null}
        {(data ?? []).map((item, idx) => (
          <div key={`${item.timestamp}-${idx}`} className="flex items-center gap-3">
            <span className="w-16 shrink-0 font-mono text-xs text-[#334155] dark:text-[hsl(0_0%_95%)]">
              {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
            </span>
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", KIND_DOT[item.type] ?? KIND_DOT.requisition)} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{item.description}</p>
              <p className="text-xs text-[#334155] dark:text-[hsl(0_0%_95%)]">{item.facilityName}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
