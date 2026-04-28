import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appPath } from "@/lib/routes";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

export function RequisitionsTable() {
  const { data } = trpc.dashboard.pendingRequisitions.useQuery({ limit: 4 });

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Pending requisitions</CardTitle>
        <Link href={appPath("/inventory/requisitions")}>
          <Button className="bg-[#DC2626] hover:bg-[#B91C1C]">Go to queue</Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Open requisitions</p>
            <p className="mt-2 text-2xl font-semibold">{data?.total ?? 0}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Urgent</p>
            <p className="mt-2 text-2xl font-semibold text-[#DC2626]">{data?.urgent ?? 0}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Oldest pending</p>
            <p className="mt-2 text-2xl font-semibold">
              {data?.oldestDaysAgo === null || data?.oldestDaysAgo === undefined ? "None" : `${data.oldestDaysAgo}d`}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border">
          {(data?.total ?? 0) === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium">No pending requisitions</p>
              <p className="mt-1 text-xs text-muted-foreground">Requisitions submitted by staff will appear here for approval</p>
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Pending requisitions are reflected in the summary above and can be reviewed in the requisitions queue.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
