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
import { Loader2, Plus, Trash2 } from "lucide-react";

type TransferSource = "relational" | "legacy";

type TransferRow = {
  id: number;
  source: TransferSource;
  documentNumber: string;
  status: string;
  fromWarehouseId: number | null;
  toWarehouseId: number | null;
};

type DraftLine = {
  catalogueId: string;
  quantity: string;
};

type AllocationSource = {
  ctnId: number;
  ctnCode: string | null;
  quantity: number;
  expiryDate: string | null;
  balance: number | null;
};

type SuggestedAllocation = {
  lineId: number;
  catalogueId: number;
  quantity: number;
  sources: AllocationSource[];
};

export default function Transfers({ embedInShell = false }: { embedInShell?: boolean } = {}) {
  const { isAdmin, isManagerOrAdmin, isStaffOrAbove } = usePermissions();
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchTarget, setDispatchTarget] = useState<TransferRow | null>(null);
  const [allocations, setAllocations] = useState<SuggestedAllocation[]>([]);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([{ catalogueId: "", quantity: "" }]);

  const { data: warehouses } = trpc.sites.list.useQuery();
  const { data: catalogue } = trpc.inventoryV2.catalogue.list.useQuery();
  const list = trpc.inventoryV2.transfers.list.useQuery({ status: status === "all" ? undefined : status });
  const utils = trpc.useUtils();

  const createMutation = trpc.inventoryV2.transfers.create.useMutation({
    onSuccess: () => {
      toast.success("Transfer note created.");
      setOpen(false);
      setDraftLines([{ catalogueId: "", quantity: "" }]);
      void list.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const approveMutation = trpc.inventoryV2.transfers.approve.useMutation({
    onSuccess: () => void list.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const dispatchMutation = trpc.inventoryV2.transfers.dispatch.useMutation({
    onSuccess: () => {
      toast.success("Transfer dispatched.");
      setDispatchOpen(false);
      setDispatchTarget(null);
      setAllocations([]);
      void list.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const receiveMutation = trpc.inventoryV2.transfers.receive.useMutation({
    onSuccess: () => void list.refetch(),
    onError: (e) => toast.error(e.message),
  });

  const wh = useMemo(() => (warehouses ?? []).filter((x) => x.facilityType === "warehouse"), [warehouses]);
  const catalogueById = useMemo(
    () => new Map((catalogue ?? []).map((item) => [item.id, item])),
    [catalogue]
  );

  const transferRef = (row: TransferRow) => ({ id: row.id, source: row.source });

  const openDispatchDialog = async (row: TransferRow) => {
    if (row.source === "legacy") {
      dispatchMutation.mutate(transferRef(row));
      return;
    }
    setDispatchTarget(row);
    try {
      const preview = await utils.inventoryV2.transfers.allocateDispatch.fetch(transferRef(row));
      setAllocations(preview.suggestedAllocations);
      setDispatchOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load dispatch allocation.");
    }
  };

  const updateAllocationQuantity = (lineId: number, ctnId: number, quantity: number) => {
    setAllocations((prev) =>
      prev.map((line) =>
        line.lineId !== lineId
          ? line
          : {
              ...line,
              sources: line.sources.map((source) =>
                source.ctnId === ctnId ? { ...source, quantity } : source
              ),
            }
      )
    );
  };

  const submitCreate = () => {
    const items = draftLines
      .filter((line) => line.catalogueId && line.quantity)
      .map((line) => ({
        catalogueId: Number(line.catalogueId),
        quantity: Number(line.quantity),
      }));
    if (!fromWarehouseId || !toWarehouseId || items.length === 0) {
      toast.error("Select warehouses and at least one line item.");
      return;
    }
    createMutation.mutate({
      fromWarehouseId: Number(fromWarehouseId),
      toWarehouseId: Number(toWarehouseId),
      items,
    });
  };

  const submitDispatch = () => {
    if (!dispatchTarget) return;
    dispatchMutation.mutate({
      ...transferRef(dispatchTarget),
      lineAllocations: allocations.map((line) => ({
        lineId: line.lineId,
        sources: line.sources.map((source) => ({
          ctnId: source.ctnId,
          quantity: source.quantity,
        })),
      })),
    });
  };

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
          {isManagerOrAdmin ? (
            <Button className="ml-auto" data-testid="new-transfer-btn" onClick={() => setOpen(true)}>
              New Transfer
            </Button>
          ) : null}
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
            {(list.data ?? []).map((row) => {
              const transfer = row as TransferRow;
              const ref = transferRef(transfer);
              const isApproving = approveMutation.isPending && approveMutation.variables?.id === transfer.id;
              const isDispatching =
                dispatchMutation.isPending &&
                dispatchMutation.variables?.id === transfer.id &&
                !dispatchOpen;
              const isReceiving = receiveMutation.isPending && receiveMutation.variables?.id === transfer.id;
              return (
                <tr key={`${transfer.source}-${transfer.id}`} data-testid={`transfer-row-${transfer.documentNumber}`} className="border-b">
                  <td className="px-2 py-2 font-mono">{transfer.documentNumber}</td>
                  <td className="px-2 py-2">{transfer.status}</td>
                  <td className="px-2 py-2">{transfer.fromWarehouseId ?? "—"}</td>
                  <td className="px-2 py-2">{transfer.toWarehouseId ?? "—"}</td>
                  <td className="px-2 py-2 space-x-2">
                    {isAdmin && transfer.status === "pending_approval" ? (
                      <Button size="sm" disabled={isApproving} onClick={() => approveMutation.mutate(ref)}>
                        {isApproving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Approving…
                          </>
                        ) : (
                          "Approve"
                        )}
                      </Button>
                    ) : null}
                    {isStaffOrAbove && transfer.status === "approved" ? (
                      <Button
                        size="sm"
                        data-testid={`dispatch-transfer-${transfer.documentNumber}`}
                        disabled={isDispatching}
                        onClick={() => void openDispatchDialog(transfer)}
                      >
                        {isDispatching ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Dispatching…
                          </>
                        ) : (
                          "Dispatch"
                        )}
                      </Button>
                    ) : null}
                    {isStaffOrAbove && transfer.status === "dispatched" ? (
                      <Button
                        size="sm"
                        data-testid={`receive-transfer-${transfer.documentNumber}`}
                        disabled={isReceiving}
                        onClick={() => receiveMutation.mutate(ref)}
                      >
                        {isReceiving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Receiving…
                          </>
                        ) : (
                          "Receive"
                        )}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Transfer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>From Warehouse</Label>
            <Select value={fromWarehouseId} onValueChange={setFromWarehouseId}>
              <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>{wh.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
            <Label>To Warehouse</Label>
            <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
              <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
              <SelectContent>
                {wh.filter((x) => String(x.id) !== fromWarehouseId).map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line items</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDraftLines((lines) => [...lines, { catalogueId: "", quantity: "" }])}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add line
                </Button>
              </div>
              {draftLines.map((line, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Item</Label>
                    <Select
                      value={line.catalogueId}
                      onValueChange={(value) =>
                        setDraftLines((lines) =>
                          lines.map((entry, i) => (i === index ? { ...entry, catalogueId: value } : entry))
                        )
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Catalogue item" /></SelectTrigger>
                      <SelectContent>
                        {(catalogue ?? []).map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.itemCode} - {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      placeholder="Qty"
                      aria-label="Quantity"
                      value={line.quantity}
                      onChange={(e) =>
                        setDraftLines((lines) =>
                          lines.map((entry, i) => (i === index ? { ...entry, quantity: e.target.value } : entry))
                        )
                      }
                    />
                  </div>
                  {draftLines.length > 1 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Remove line"
                      onClick={() => setDraftLines((lines) => lines.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={createMutation.isPending} onClick={submitCreate}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dispatch transfer {dispatchTarget?.documentNumber}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            FEFO-suggested CTN allocations. Adjust quantities before dispatch if needed.
          </p>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto">
            {allocations.map((line) => {
              const item = catalogueById.get(line.catalogueId);
              return (
                <div key={line.lineId} className="rounded-md border p-3">
                  <p className="font-medium">
                    {item ? `${item.itemCode} — ${item.name}` : `Item #${line.catalogueId}`} ({line.quantity})
                  </p>
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-1">CTN</th>
                        <th className="py-1">Expiry</th>
                        <th className="py-1">On hand</th>
                        <th className="py-1">Dispatch qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {line.sources.map((source) => (
                        <tr key={source.ctnId} className="border-b">
                          <td className="py-1 font-mono">{source.ctnCode ?? source.ctnId}</td>
                          <td className="py-1">{source.expiryDate ?? "—"}</td>
                          <td className="py-1">{source.balance ?? "—"}</td>
                          <td className="py-1">
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              className="h-8 w-24"
                              value={source.quantity}
                              onChange={(e) =>
                                updateAllocationQuantity(line.lineId, source.ctnId, Number(e.target.value))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDispatchOpen(false)}>Cancel</Button>
            <Button disabled={dispatchMutation.isPending} onClick={submitDispatch}>
              {dispatchMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Dispatching…
                </>
              ) : (
                "Confirm dispatch"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
