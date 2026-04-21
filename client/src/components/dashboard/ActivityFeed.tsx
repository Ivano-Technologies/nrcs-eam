import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const KIND_DOT: Record<string, string> = {
  in: "bg-green-500",
  out: "bg-red-500",
  req: "bg-amber-500",
  maint: "bg-blue-500",
  fuel: "bg-purple-500",
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
        {(data ?? []).map((item, idx) => (
          <div key={`${item.timestamp}-${idx}`} className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground w-12 shrink-0">{item.timestamp}</span>
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", KIND_DOT[item.kind] ?? KIND_DOT.req)} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.location}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
