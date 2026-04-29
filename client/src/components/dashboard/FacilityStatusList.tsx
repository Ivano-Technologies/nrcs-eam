import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function statusClass(status: "active" | "offline") {
  if (status === "active") return "bg-green-100 text-green-700";
  return "bg-slate-100 text-slate-700";
}

export function FacilityStatusList() {
  const { data } = trpc.dashboard.facilityStatus.useQuery();
  const scoreToneClass = (score: number) => {
    if (score >= 70) return "bg-green-500";
    if (score >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="dashboard-section-title">Facility status</CardTitle>
        <CardDescription className="text-[#334155] dark:text-[hsl(0_0%_95%)]">Facility records from the live sites table</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(data ?? []).length === 0 ? <p className="text-sm text-[#334155] dark:text-[hsl(0_0%_95%)]">No facilities found.</p> : null}
        {(data ?? []).map((row) => (
          <div key={row.id} className="flex items-center gap-4 rounded-xl border p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{row.name}</p>
              <p className="text-xs text-[#334155] dark:text-[hsl(0_0%_95%)]">
                {row.code ?? "No code"} · {row.type}
              </p>
              {row.stockScore !== null ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-all", scoreToneClass(row.stockScore))} style={{ width: `${row.stockScore}%` }} />
                  </div>
                  <span className="text-xs font-medium text-[#334155] dark:text-[hsl(0_0%_95%)]">{row.stockScore}%</span>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#334155] dark:text-[hsl(0_0%_95%)]">No stock data</p>
              )}
            </div>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium capitalize", statusClass(row.status))}>{row.status}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
