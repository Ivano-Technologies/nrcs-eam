import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appPath } from "@/lib/routes";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

export function RequisitionsTable() {
  const { data } = trpc.dashboard.pendingRequisitions.useQuery({ limit: 4 });

  return (
    <Card className="dashboard-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="dashboard-section-title">Pending requisitions</CardTitle>
        <Link href={appPath("/inventory/requisitions")}>
          <Button className="rounded-lg bg-[#EE1C25] font-semibold text-white hover:bg-[#c8151c] dark:bg-[#EE1C25] dark:text-white dark:hover:bg-[#c8151c]">
            Go to queue
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)]">
            <p className="text-sm text-[#334155] dark:text-[hsl(0_0%_95%)]">Open requisitions</p>
            <p className="mt-2 text-[1.75rem] font-bold text-[#1a2332] dark:text-[hsl(0_0%_95%)]">{data?.total ?? 0}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)]">
            <p className="text-sm text-[#334155] dark:text-[hsl(0_0%_95%)]">Urgent</p>
            <p
              className={`mt-2 text-[1.75rem] font-bold ${(data?.urgent ?? 0) > 0 ? "text-[#DC2626] dark:text-[#EE1C25]" : "text-[#1a2332] dark:text-[hsl(0_0%_95%)]"}`}
            >
              {data?.urgent ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)]">
            <p className="text-sm text-[#334155] dark:text-[hsl(0_0%_95%)]">Oldest pending</p>
            <p className="mt-2 text-[1.75rem] font-bold text-[#1a2332] dark:text-[hsl(0_0%_95%)]">
              {data?.oldestDaysAgo === null || data?.oldestDaysAgo === undefined ? "None" : `${data.oldestDaysAgo}d`}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border">
          {(data?.total ?? 0) === 0 ? (
            <div className="dashboard-empty-state px-4 py-8">
              <p className="text-sm font-medium">No pending requisitions</p>
              <p className="dashboard-empty-state-subtitle mt-1 text-xs">Requisitions submitted by staff will appear here for approval</p>
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-[#334155] dark:text-[hsl(0_0%_95%)]">
              Pending requisitions are reflected in the summary above and can be reviewed in the requisitions queue.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
