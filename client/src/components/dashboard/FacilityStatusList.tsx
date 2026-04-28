import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function statusClass(status: "active" | "offline") {
  if (status === "active") return "bg-green-100 text-green-700";
  return "bg-slate-100 text-slate-700";
}

export function FacilityStatusList() {
  const { data } = trpc.dashboard.facilityStatus.useQuery();

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Facility status</CardTitle>
        <CardDescription>Facility records from the live sites table</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No facilities found.</p> : null}
        {(data ?? []).map((row) => (
          <div key={row.id} className="flex items-center gap-4 rounded-xl border p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{row.name}</p>
              <p className="text-xs text-muted-foreground">
                {row.code ?? "No code"} · {row.type}
              </p>
            </div>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium capitalize", statusClass(row.status))}>{row.status}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
