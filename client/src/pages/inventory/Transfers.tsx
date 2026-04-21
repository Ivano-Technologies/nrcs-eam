import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { toast } from "sonner";

export default function Transfers({ embedInShell = false }: { embedInShell?: boolean } = {}) {
  const { isAdmin, isManagerOrAdmin, isStaffOrAbove } = usePermissions();
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [catalogueId, setCatalogueId] = useState("");
  const [quantity, setQuantity] = useState("");

  const { data: warehouses } = trpc.sites.list.useQuery();
  const { data: catalogue } = trpc.inventoryV2.catalogue.list.useQuery();
  const list = trpc.inventoryV2.transfers.list.useQuery({ status: status === "all" ? undefined : status });
  const createMutation = trpc.inventoryV2.transfers.create.useMutation({
    onSuccess: () => {
      toast.success("Transfer note created.");
      setOpen(false);
      void list.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const approveMutation = trpc.inventoryV2.transfers.approve.useMutation({
    onSuccess: () => void list.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const dispatchMutation = trpc.inventoryV2.transfers.dispatch.useMutation({
    onSuccess: () => void list.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const receiveMutation = trpc.inventoryV2.transfers.receive.useMutation({
    onSuccess: () => void list.refetch(),
    onError: (e) => toast.error(e.message),
  });

  const wh = useMemo(() => (warehouses ?? []).filter((x) => x.facilityType === "warehouse"), [warehouses]);

  return (
    <div className="space-y-4">
      {!embedInShell ? (
        <>
          <h1 className="text-3xl font-bold">Transfers</h1>
          <InventorySecondaryNav />
        </>
      ) : null}
      <Card>
        <CardContent className="flex items-center gap-2 pt-4">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending_approval">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          {isManagerOrAdmin ? <Button className="ml-auto" data-testid="new-transfer-btn" onClick={() => setOpen(true)}>New Transfer</Button> : null}
        </CardContent>
      </Card>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="px-2 py-2 text-left">Document #</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">From</th>
              <th className="px-2 py-2 text-left">To</th>
              <th className="px-2 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((row) => (
              <tr key={row.id} data-testid={`transfer-row-${row.documentNumber}`} className="border-b">
                <td className="px-2 py-2 font-mono">{row.documentNumber}</td>
                <td className="px-2 py-2">{row.status}</td>
                <td className="px-2 py-2">{row.fromWarehouseId ?? "—"}</td>
                <td className="px-2 py-2">{row.toWarehouseId ?? "—"}</td>
                <td className="px-2 py-2 space-x-2">
                  {isAdmin && row.status === "pending_approval" ? (
                    <Button size="sm" onClick={() => approveMutation.mutate({ documentId: row.id })}>Approve</Button>
                  ) : null}
                  {isStaffOrAbove && (row.status === "approved" || row.status === "pending_approval") ? (
                    <Button size="sm" onClick={() => dispatchMutation.mutate({ documentId: row.id })}>Dispatch</Button>
                  ) : null}
                  {isStaffOrAbove && row.status === "dispatched" ? (
                    <Button size="sm" onClick={() => receiveMutation.mutate({ documentId: row.id })}>Receive</Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Transfer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>From Warehouse</Label>
            <Select value={fromWarehouseId} onValueChange={setFromWarehouseId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{wh.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
            <Label>To Warehouse</Label>
            <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{wh.filter((x) => String(x.id) !== fromWarehouseId).map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
            <Label>Item</Label>
            <Select value={catalogueId} onValueChange={setCatalogueId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(catalogue ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.itemCode} - {c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Label>Quantity</Label>
            <Input placeholder="Quantity" aria-label="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    fromWarehouseId: Number(fromWarehouseId),
                    toWarehouseId: Number(toWarehouseId),
                    items: [{ catalogueId: Number(catalogueId), quantity: Number(quantity) }],
                  })
                }
              >
                Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
