import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import { toast } from "sonner";
import { usePermissions } from "@/_core/hooks/usePermissions";

export default function Issues() {
  const { isManagerOrAdmin, isStaffOrAbove } = usePermissions();
  const [status, setStatus] = useState("all");
  const [warehouseId, setWarehouseId] = useState("all");
  const [open, setOpen] = useState(false);
  const [destinationName, setDestinationName] = useState("");
  const [lineItem, setLineItem] = useState({ catalogueId: "", quantity: "" });

  const { data: warehouses } = trpc.sites.list.useQuery();
  const { data: catalogue } = trpc.inventoryV2.catalogue.list.useQuery();
  const waybills = trpc.inventoryV2.issues.list.useQuery({
    warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
    status: status === "all" ? undefined : status,
  });
  const createMutation = trpc.inventoryV2.issues.create.useMutation({
    onSuccess: () => {
      toast.success("Waybill created.");
      setOpen(false);
      void waybills.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const approveMutation = trpc.inventoryV2.issues.approve.useMutation({
    onSuccess: () => void waybills.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const dispatchMutation = trpc.inventoryV2.issues.dispatch.useMutation({
    onSuccess: () => {
      toast.success("Waybill dispatched.");
      void waybills.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const wh = useMemo(() => (warehouses ?? []).filter((x) => x.facilityType === "warehouse"), [warehouses]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Issues (Waybills)</h1>
      <InventorySecondaryNav />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-4">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending_approval">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
            </SelectContent>
          </Select>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Origin warehouse" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All warehouses</SelectItem>
              {wh.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {isStaffOrAbove ? <Button data-testid="new-waybill-btn" className="ml-auto" onClick={() => setOpen(true)}>New Waybill</Button> : null}
        </CardContent>
      </Card>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="px-2 py-2 text-left">Document #</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">From</th>
              <th className="px-2 py-2 text-left">Created</th>
              <th className="px-2 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(waybills.data ?? []).map((row) => (
              <tr key={row.id} data-testid={`waybill-row-${row.documentNumber}`} className="border-b">
                <td className="px-2 py-2 font-mono">{row.documentNumber}</td>
                <td className="px-2 py-2">{row.status}</td>
                <td className="px-2 py-2">{row.fromWarehouseId ?? "—"}</td>
                <td className="px-2 py-2">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</td>
                <td className="px-2 py-2 space-x-2">
                  {isManagerOrAdmin && row.status === "pending_approval" ? (
                    <Button size="sm" onClick={() => approveMutation.mutate({ documentId: row.id })}>Approve</Button>
                  ) : null}
                  {isStaffOrAbove && (row.status === "approved" || row.status === "pending_approval") ? (
                    <Button size="sm" data-testid="dispatch-waybill-btn" onClick={() => dispatchMutation.mutate({ documentId: row.id })}>
                      Dispatch
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Waybill</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Origin Warehouse</Label>
            <Select value={warehouseId === "all" ? "" : warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder="Warehouse" /></SelectTrigger>
              <SelectContent>{wh.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
            <Label>Destination</Label>
            <Input placeholder="Destination" aria-label="Destination" value={destinationName} onChange={(e) => setDestinationName(e.target.value)} />
            <Label>Item</Label>
            <Select value={lineItem.catalogueId} onValueChange={(v) => setLineItem((p) => ({ ...p, catalogueId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
              <SelectContent>{(catalogue ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.itemCode} - {c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Label>Quantity</Label>
            <Input placeholder="Quantity" aria-label="Quantity" value={lineItem.quantity} onChange={(e) => setLineItem((p) => ({ ...p, quantity: e.target.value }))} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    fromWarehouseId: Number(warehouseId),
                    destinationName,
                    issueType: "distribution",
                    items: [{ catalogueId: Number(lineItem.catalogueId), quantity: Number(lineItem.quantity) }],
                  })
                }
              >
                Submit for approval
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
