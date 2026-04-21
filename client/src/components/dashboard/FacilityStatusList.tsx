import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function progressColor(percent: number) {
  if (percent >= 70) return "[&>div]:bg-green-500";
  if (percent >= 45) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-500";
}

export function FacilityStatusList() {
  const { data } = trpc.dashboard.facilityStatus.useQuery();

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Facility status</CardTitle>
        <CardDescription>Current stock readiness by location</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(data ?? []).map((row) => (
          <div key={row.name} className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.region}</p>
            </div>
            <div className="w-36 shrink-0">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Stock</span>
                <span className="font-medium">{row.stockPercent}%</span>
              </div>
              <Progress value={row.stockPercent} className={cn("h-2", progressColor(row.stockPercent))} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
