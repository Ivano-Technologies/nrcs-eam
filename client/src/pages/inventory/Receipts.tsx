import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import { toast } from "sonner";
import { usePermissions } from "@/_core/hooks/usePermissions";

function downloadBase64File(data: string, filename: string, mimeType: string) {
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type Line = { catalogueId: string; ctnId: string; quantity: string; batchNumber: string; expiryDate: string; notes: string };

export default function Receipts({ embedInShell = false }: { embedInShell?: boolean } = {}) {
  const { isManagerOrAdmin, isStaffOrAbove } = usePermissions();
  const [status, setStatus] = useState("all");
  const [warehouseId, setWarehouseId] = useState("all");
  const [open, setOpen] = useState(false);
  const [referenceDocument, setReferenceDocument] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { catalogueId: "", ctnId: "", quantity: "", batchNumber: "", expiryDate: "", notes: "" },
  ]);

  const { data: warehouses } = trpc.sites.list.useQuery();
  const wh = useMemo(() => (warehouses ?? []).filter((x) => x.facilityType === "warehouse"), [warehouses]);
  const { data: catalogue } = trpc.inventoryV2.catalogue.list.useQuery();
  const receipts = trpc.inventoryV2.receipts.list.useQuery({
    warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
    status: status === "all" ? undefined : status,
  });

  const createMutation = trpc.inventoryV2.receipts.create.useMutation({
    onSuccess: () => {
      toast.success("GRN created.");
      void receipts.refetch();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const approveMutation = trpc.inventoryV2.receipts.approve.useMutation({
    onSuccess: () => {
      toast.success("GRN approved.");
      void receipts.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const downloadPdfMutation = trpc.inventoryV2.receipts.downloadPdf.useMutation({
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {!embedInShell ? (
        <>
          <h1 className="text-3xl font-bold">Receipts (GRN)</h1>
          <InventorySecondaryNav />
        </>
      ) : null}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-4">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_approval">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {wh.map((w) => (
                <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isStaffOrAbove ? (
            <Button data-testid="new-grn-btn" className="ml-auto" onClick={() => setOpen(true)}>
              New GRN
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
              <th className="px-2 py-2 text-left">Warehouse</th>
              <th className="px-2 py-2 text-left">Created</th>
              <th className="px-2 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(receipts.data ?? []).map((row) => (
              <tr key={row.id} data-testid={`grn-row-${row.documentNumber}`} className="border-b">
                <td className="px-2 py-2 font-mono">{row.documentNumber}</td>
                <td className="px-2 py-2">{row.status}</td>
                <td className="px-2 py-2">{row.toWarehouseId ?? "—"}</td>
                <td className="px-2 py-2">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</td>
                <td className="px-2 py-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="mr-2"
                    disabled={downloadPdfMutation.isPending}
                    onClick={async () => {
                      try {
                        const file = await downloadPdfMutation.mutateAsync({ documentId: row.id });
                        downloadBase64File(file.data, file.filename || `${row.documentNumber}.pdf`, file.mimeType);
                        toast.success("PDF downloaded.");
                      } catch {
                        // handled in mutation onError
                      }
                    }}
                  >
                    {downloadPdfMutation.isPending ? "Generating..." : "Download PDF"}
                  </Button>
                  {isManagerOrAdmin && row.status === "pending_approval" ? (
                    <Button
                      size="sm"
                      data-testid="approve-grn-btn"
                      onClick={() => approveMutation.mutate({ documentId: row.id })}
                    >
                      Approve
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>New GRN</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Label>Warehouse</Label>
            <Select value={warehouseId === "all" ? "" : warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder="Select destination warehouse" /></SelectTrigger>
              <SelectContent>
                {wh.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Label>Supplier / Donor</Label>
            <Input placeholder="Supplier / Donor" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            <Label>Reference Number</Label>
            <Input placeholder="Reference Number" value={referenceDocument} onChange={(e) => setReferenceDocument(e.target.value)} />

            <div className="space-y-2">
              <Label>Line Items</Label>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-2">
                  <Select
                    value={line.catalogueId}
                    onValueChange={(v) =>
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, catalogueId: v } : x)))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                    <SelectContent>
                      {(catalogue ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.itemCode} - {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="CTN ID"
                    value={line.ctnId}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, ctnId: e.target.value } : x)))}
                  />
                  <Input
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                  />
                  <Input
                    placeholder="Batch #"
                    value={line.batchNumber}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, batchNumber: e.target.value } : x)))}
                  />
                  <Input
                    type="date"
                    value={line.expiryDate}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, expiryDate: e.target.value } : x)))}
                  />
                  <Input
                    placeholder="Notes"
                    value={line.notes}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x)))}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setLines((p) => [...p, { catalogueId: "", ctnId: "", quantity: "", batchNumber: "", expiryDate: "", notes: "" }])
                }
              >
                Add Line
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    warehouseId: Number(warehouseId),
                    receiptType: "purchase",
                    supplierName,
                    referenceDocument,
                    items: lines
                      .filter((x) => x.catalogueId && x.ctnId && Number(x.quantity) > 0)
                      .map((x) => ({
                        catalogueId: Number(x.catalogueId),
                        ctnId: Number(x.ctnId),
                        quantity: Number(x.quantity),
                        batchNumber: x.batchNumber || undefined,
                        expiryDate: x.expiryDate || undefined,
                        notes: x.notes || undefined,
                      })),
                  })
                }
              >
                Submit for Approval
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
