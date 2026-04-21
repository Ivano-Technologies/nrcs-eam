import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function daysRemaining(date: string | Date | null | undefined) {
  if (!date) return null;
  const d = new Date(date);
  const today = new Date();
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Expiry() {
  const { isManagerOrAdmin } = usePermissions();
  const [selectedExpired, setSelectedExpired] = useState<number[]>([]);
  const soon = trpc.inventoryV2.expiry.upcoming.useQuery({ days: 90 });
  const expired = trpc.inventoryV2.expiry.expired.useQuery();
  const markExpired = trpc.inventoryV2.expiry.markExpired.useMutation({
    onSuccess: () => {
      toast.success("Batch marked expired.");
      void soon.refetch();
      void expired.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const disposeExpired = trpc.inventoryV2.expiry.disposeExpired.useMutation({
    onSuccess: (res) => {
      toast.success(`Disposal waybill created: ${res.documentNumber}`);
      void expired.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const disposed = useMemo(() => (expired.data ?? []).filter((x) => x.status === "disposed"), [expired.data]);
  const expiredOnly = useMemo(() => (expired.data ?? []).filter((x) => x.status === "expired"), [expired.data]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Expiry Tracking</h1>
      <InventorySecondaryNav />
      <Tabs defaultValue="soon">
        <TabsList>
          <TabsTrigger value="soon" data-testid="expiry-tab-soon">Expiring Soon (&lt;90d)</TabsTrigger>
          <TabsTrigger value="expired" data-testid="expiry-tab-expired">Expired</TabsTrigger>
          <TabsTrigger value="disposed" data-testid="expiry-tab-disposed">Disposed</TabsTrigger>
        </TabsList>
        <TabsContent value="soon">
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left">Item</th>
                  <th className="px-2 py-2 text-left">Warehouse</th>
                  <th className="px-2 py-2 text-left">Batch</th>
                  <th className="px-2 py-2 text-left">Expiry</th>
                  <th className="px-2 py-2 text-left">Days</th>
                  <th className="px-2 py-2 text-left">Qty</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(soon.data ?? []).map((row) => {
                  const days = daysRemaining(row.expiryDate as any);
                  const tone = days == null ? "outline" : days <= 30 ? "destructive" : days <= 60 ? "default" : "secondary";
                  return (
                    <tr key={row.batchId} data-testid={`expiry-row-${row.batchId}`} className="border-b">
                      <td className="px-2 py-2">{row.itemCode} - {row.itemName}</td>
                      <td className="px-2 py-2">{row.warehouseName}</td>
                      <td className="px-2 py-2">{row.batchNumber ?? "—"}</td>
                      <td className="px-2 py-2">{row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : "—"}</td>
                      <td className="px-2 py-2"><Badge variant={tone as any}>{days ?? "—"}</Badge></td>
                      <td className="px-2 py-2">{row.quantity}</td>
                      <td className="px-2 py-2">
                        {isManagerOrAdmin ? (
                          <Button size="sm" onClick={() => markExpired.mutate({ batchId: row.batchId })}>Mark expired</Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="expired">
          <div className="space-y-2">
            {isManagerOrAdmin ? (
              <Button
                onClick={() => disposeExpired.mutate({ batchIds: selectedExpired })}
                disabled={!selectedExpired.length}
              >
                Create disposal waybill
              </Button>
            ) : null}
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left">Select</th>
                    <th className="px-2 py-2 text-left">Batch</th>
                    <th className="px-2 py-2 text-left">Expiry</th>
                    <th className="px-2 py-2 text-left">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {expiredOnly.map((row) => (
                    <tr key={row.id} data-testid={`expiry-row-${row.id}`} className="border-b">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedExpired.includes(row.id)}
                          onChange={(e) =>
                            setSelectedExpired((prev) =>
                              e.target.checked ? [...prev, row.id] : prev.filter((x) => x !== row.id)
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-2">{row.batchNumber ?? "—"}</td>
                      <td className="px-2 py-2">{row.expiryDate ? String(row.expiryDate) : "—"}</td>
                      <td className="px-2 py-2">{row.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="disposed">
          <div className="rounded-md border p-3 text-sm text-muted-foreground">
            {disposed.length} disposed batch(es).
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
