import { useMemo } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import PageLoader from "@/components/ui/PageLoader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { appPath } from "@/lib/routes";
import { Link } from "wouter";
import { FACILITY_TYPE_LABELS } from "@shared/facilities";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";

export default function FacilityDetail() {
  const { isManagerOrAdmin } = usePermissions();
  const [match, params] = useRoute("/app/facilities/:id");
  const id = match ? Number(params.id) : NaN;
  const enabled = Number.isFinite(id);
  const { data: facility } = trpc.sites.getById.useQuery({ id }, { enabled });
  const { data: allFacilities } = trpc.sites.list.useQuery(undefined, { enabled });
  const { data: assets } = trpc.assets.list.useQuery({ siteId: id }, { enabled });
  const { data: inventory } = trpc.inventory.list.useQuery({ siteId: id }, { enabled });
  const { data: workOrders } = trpc.workOrders.list.useQuery({ siteId: id }, { enabled });
  const { data: movements } = trpc.inventory.movements.useQuery({ siteId: id }, { enabled });
  const { data: transfers } = trpc.transfers.list.useQuery({ siteId: id }, { enabled });

  const utils = trpc.useUtils();
  const syncCoordsMutation = trpc.assets.syncCoordinatesForSite.useMutation({
    onSuccess: (res) => {
      toast.success(`Updated coordinates on ${res.updated} asset(s) at this facility.`);
      void utils.assets.list.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Sync failed"),
  });

  const childFacilities = useMemo(
    () => (allFacilities ?? []).filter((f) => f.parentFacilityId === id),
    [allFacilities, id]
  );

  const recentWorkOrders = useMemo(
    () =>
      [...(workOrders ?? [])]
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        .slice(0, 5),
    [workOrders]
  );
  const recentMovements = useMemo(
    () =>
      [...(movements ?? [])]
        .sort((a, b) => +new Date(b.transactionDate) - +new Date(a.transactionDate))
        .slice(0, 5),
    [movements]
  );
  const recentTransfers = useMemo(
    () =>
      [...(transfers ?? [])]
        .sort((a, b) => +new Date(b.requestDate) - +new Date(a.requestDate))
        .slice(0, 5),
    [transfers]
  );

  if (!enabled) return <div className="text-sm text-muted-foreground">Invalid facility id.</div>;
  if (!facility) return <PageLoader />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {facility.name}
            <Badge variant="outline">{FACILITY_TYPE_LABELS[facility.facilityType]}</Badge>
          </CardTitle>
          {isManagerOrAdmin ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncCoordsMutation.isPending}
              onClick={() => syncCoordsMutation.mutate({ siteId: facility.id })}
            >
              {syncCoordsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing…
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-4 w-4" />
                  Sync asset coordinates from facility
                </>
              )}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <p><span className="font-medium">Code:</span> {facility.code ?? "—"}</p>
          <p><span className="font-medium">Status:</span> {facility.isActive ? "Active" : "Inactive"}</p>
          <p className="md:col-span-2"><span className="font-medium">Address:</span> {facility.address ?? "—"}</p>
          <p><span className="font-medium">State:</span> {facility.state ?? "—"}</p>
          <p><span className="font-medium">Postal code:</span> {facility.postalCode ?? "—"}</p>
          <p><span className="font-medium">Contact:</span> {facility.contactPerson ?? "—"}</p>
          <p><span className="font-medium">Phone:</span> {facility.contactPhone ?? "—"}</p>
          <div className="md:col-span-2">
            <a
              className="text-primary underline-offset-4 hover:underline"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${facility.address ?? ""} ${facility.city ?? ""} ${facility.state ?? ""}`
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Map
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Child Facilities</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {childFacilities.length === 0 ? "No child facilities." : childFacilities.map((c) => (
            <div key={c.id} className="flex items-center justify-between">
              <span>{c.name}</span>
              <Badge variant="outline">{FACILITY_TYPE_LABELS[c.facilityType]}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Statistics</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatLink label="Asset count" value={assets?.length ?? 0} href={`${appPath("/assets")}?siteId=${facility.id}`} />
          <StatLink label="Inventory count" value={inventory?.length ?? 0} href={`${appPath("/inventory/stock-overview")}?siteId=${facility.id}`} />
          <StatLink label="Active work orders" value={(workOrders ?? []).filter((w) => w.status !== "completed" && w.status !== "cancelled").length} href={`${appPath("/work-orders")}?siteId=${facility.id}`} />
          <StatLink label="Staff assigned" value={(allFacilities ?? []).find((f) => f.id === facility.id)?.staffCount ?? 0} href={appPath("/settings/users")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <section>
            <h3 className="mb-1 font-medium">Recent Asset Movements</h3>
            {recentTransfers.length === 0 ? "No recent asset movements." : (
              <ul className="space-y-1">
                {recentTransfers.map((t) => (
                  <li key={t.id}>{t.status} transfer #{t.id} - {new Date(t.requestDate).toLocaleDateString()}</li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="mb-1 font-medium">Recent Work Orders</h3>
            {recentWorkOrders.length === 0 ? "No recent work orders." : (
              <ul className="space-y-1">
                {recentWorkOrders.map((w) => (
                  <li key={w.id}>{w.workOrderNumber} - {w.title}</li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="mb-1 font-medium">Recent Inventory Transactions</h3>
            {recentMovements.length === 0 ? "No recent inventory transactions." : (
              <ul className="space-y-1">
                {recentMovements.map((m, i) => (
                  <li key={`${m.itemCode}-${i}`}>{m.itemCode} - {m.type} {m.quantity} ({new Date(m.transactionDate).toLocaleDateString()})</li>
                ))}
              </ul>
            )}
          </section>
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link href={appPath("/facilities/all")}>Back to Facilities</Link>
      </Button>
    </div>
  );
}

function StatLink({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <a href={href} className="rounded-md border p-3 hover:bg-muted/50">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </a>
  );
}
