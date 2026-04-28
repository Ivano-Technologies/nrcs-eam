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
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Latest operational events</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No recent activity yet.</p> : null}
        {(data ?? []).map((item, idx) => (
          <div key={`${item.timestamp}-${idx}`} className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">
              {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
            </span>
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", KIND_DOT[item.type] ?? KIND_DOT.requisition)} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{item.description}</p>
              <p className="text-xs text-muted-foreground">{item.facilityName}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
