import { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { InventoryShellActions } from "@/components/inventory/InventoryShell";
import { DATE_INPUT_HINT, formatDate } from "@/lib/format";
import { HtmlTableEmptyState } from "@/components/ui/EmptyState";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import PageHeader from "@/components/ui/PageHeader";
import { PackageCheck as PackageCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Toolbar, ToolbarMore, ToolbarSearch } from "@/components/Toolbar";
import { useMobileTableColumns, MobileColumnsToggle, mobileSecondaryCol } from "@/hooks/useMobileTableColumns";
import { cn } from "@/lib/utils";
import { useLocation, useSearch } from "wouter";
import { downloadBase64File } from "@/lib/download";
import { appPath } from "@/lib/routes";
import { Loader2 } from "lucide-react";

type Line = { catalogueId: string; ctnId: string; quantity: string; batchNumber: string; expiryDate: string; notes: string };

export default function Receipts({ embedInShell = false }: { embedInShell?: boolean } = {}) {
  const { isMobile, showAllColumns, showAll, setShowAll } = useMobileTableColumns();
  const [, setLocation] = useLocation();
  const urlSearch = useSearch();
  const { isManagerOrAdmin, isStaffOrAbove } = usePermissions();
  const [status, setStatus] = useState<"all" | "draft" | "pending_approval" | "finalized" | "claim_raised">("all");
  const [warehouseId, setWarehouseId] = useState("all");
  const [search, setSearch] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(false);
  const [referenceDocument, setReferenceDocument] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { catalogueId: "", ctnId: "", quantity: "", batchNumber: "", expiryDate: "", notes: "" },
  ]);

  useEffect(() => {
    const st = new URLSearchParams(urlSearch).get("status");
    if (st === "all" || st === "draft" || st === "pending_approval" || st === "finalized" || st === "claim_raised") {
      setStatus(st);
    }
  }, [urlSearch]);

  const { data: warehouses } = trpc.sites.list.useQuery();
  const wh = useMemo(() => (warehouses ?? []).filter((x) => x.facilityType === "warehouse"), [warehouses]);
  const { data: catalogue } = trpc.inventoryV2.catalogue.list.useQuery();
  const receipts = trpc.inventoryV2.receipts.list.useQuery({
    warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
    status: status === "all" ? undefined : status,
    search: search || undefined,
    receivedFrom: receivedFrom || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
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

  const newGrnButton = isStaffOrAbove ? (
    <Button className="h-9" data-testid="new-grn-btn" onClick={() => setLocation("/app/inventory/receipts/new")}>
      New GRN
    </Button>
  ) : null;

  return (
    <div className="space-y-6">
      <InventoryShellActions>{newGrnButton}</InventoryShellActions>
      {!embedInShell ? (
        <>
          <PageHeader icon={PackageCheckIcon} title="Receiving" actions={newGrnButton ?? undefined} />
          <InventorySecondaryNav />
        </>
      ) : null}
      <Toolbar
        filters={
          <>
            <ToolbarSearch
              placeholder="Search GRN number or consignment"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Input
              className="h-9 w-36"
              placeholder="Received from"
              value={receivedFrom}
              onChange={(e) => setReceivedFrom(e.target.value)}
            />
            <Input className="h-9 w-36" type="date" aria-label="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input className="h-9 w-36" type="date" aria-label="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <span className="text-xs text-muted-foreground">Dates use {DATE_INPUT_HINT}</span>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_approval">Pending approval</SelectItem>
                <SelectItem value="finalized">Finalised</SelectItem>
                <SelectItem value="claim_raised">Claim raised</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        end={
          <>
            <MobileColumnsToggle isMobile={isMobile} showAll={showAll} onToggle={setShowAll} />
            <ToolbarMore>
              <DropdownMenuItem onSelect={() => setLocation(appPath("/inventory/import"))}>
                <Upload className="mr-2 h-4 w-4" aria-hidden />
                Import from file
              </DropdownMenuItem>
            </ToolbarMore>
          </>
        }
      />

      <div
        className="frozen-table-wrap sticky-first-col rounded-md border"
        style={
          {
            "--col1-width": "170px",
            "--col2-width": "170px",
          } as Record<string, string>
        }
      >
        <table
          className="min-w-[1080px] w-full text-sm"
        >
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="px-2 py-2 text-left">Document #</th>
              <th className={cn("px-2 py-2 text-left", mobileSecondaryCol(showAllColumns))}>Date of arrival</th>
              <th className="px-2 py-2 text-left">Received from</th>
              <th className={cn("px-2 py-2 text-left", mobileSecondaryCol(showAllColumns))}>Consignment(s)</th>
              <th className={cn("px-2 py-2 text-left", mobileSecondaryCol(showAllColumns))}>Items</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className={cn("px-2 py-2 text-left", mobileSecondaryCol(showAllColumns))}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(receipts.data ?? []).map((row) => (
              <tr
                key={`${row.source}-${row.id}`}
                data-testid={`grn-row-${row.documentNumber}`}
                className="cursor-pointer border-b hover:bg-muted/30"
                onClick={() =>
                  setLocation(
                    row.source === "legacy"
                      ? `/app/inventory/receipts/${row.id}?source=legacy`
                      : `/app/inventory/receipts/${row.id}`
                  )
                }
              >
                <td className="px-2 py-2 font-mono">{row.documentNumber}</td>
                <td className={cn("px-2 py-2", mobileSecondaryCol(showAllColumns))}>
                  {row.dateOfArrival
                    ? formatDate(row.dateOfArrival)
                    : row.createdAt
                      ? formatDate(row.createdAt)
                      : ""}
                </td>
                <td className="px-2 py-2">{row.referenceDocument ?? ""}</td>
                <td className={cn("px-2 py-2", mobileSecondaryCol(showAllColumns))}>{row.referenceDocument ?? ""}</td>
                <td className={cn("px-2 py-2", mobileSecondaryCol(showAllColumns))}>{row.lineCount}</td>
                <td className="px-2 py-2">
                  {row.status === "finalized" || row.status === "completed" ? (
                    <Badge className="bg-green-600">Finalised</Badge>
                  ) : row.status === "claim_raised" ? (
                    <Badge variant="destructive">claim_raised</Badge>
                  ) : row.status === "pending_approval" ? (
                    <Badge variant="outline">pending approval</Badge>
                  ) : (
                    <Badge variant="secondary">draft</Badge>
                  )}
                </td>
                <td className={cn("px-2 py-2", mobileSecondaryCol(showAllColumns))}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mr-2"
                    disabled={downloadPdfMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      void (async () => {
                        try {
                          const file = await downloadPdfMutation.mutateAsync({
                            documentId: row.id,
                            source: row.source,
                          });
                          downloadBase64File(file.data, file.filename || `${row.documentNumber}.pdf`, file.mimeType);
                          toast.success("PDF downloaded.");
                        } catch {
                          // handled in mutation onError
                        }
                      })();
                    }}
                  >
                    {downloadPdfMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating…
                      </>
                    ) : (
                      "Download PDF"
                    )}
                  </Button>
                  {isManagerOrAdmin && row.status === "pending_approval" ? (
                    <Button
                      size="sm"
                      data-testid="approve-grn-btn"
                      disabled={approveMutation.isPending && approveMutation.variables?.documentId === row.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        approveMutation.mutate({ documentId: row.id, source: row.source });
                      }}
                    >
                      {approveMutation.isPending && approveMutation.variables?.documentId === row.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Approving…
                        </>
                      ) : (
                        "Approve"
                      )}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!receipts.isLoading && (receipts.data ?? []).length === 0 ? (
              <HtmlTableEmptyState
                colSpan={7}
                icon={PackageCheckIcon}
                title="No receipts yet"
              />
            ) : null}
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
            <Label>Supplier / donor</Label>
            <Input placeholder="Supplier / donor" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            <Label>Reference number</Label>
            <Input placeholder="Reference number" value={referenceDocument} onChange={(e) => setReferenceDocument(e.target.value)} />

            <div className="space-y-2">
              <Label>Line items</Label>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-3" data-testid={`grn-line-${idx}`}>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Item</Label><Select
                    value={line.catalogueId}
                    onValueChange={(v) =>
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, catalogueId: v } : x)))
                    }
                  >
                    <SelectTrigger aria-label="Item"><SelectValue placeholder="Item" /></SelectTrigger>
                    <SelectContent>
                      {(catalogue ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.itemCode} · {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">CTN ID</Label><Input aria-label="CTN ID"
                    placeholder="CTN ID"
                    value={line.ctnId}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, ctnId: e.target.value } : x)))}
                  /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Qty</Label><Input aria-label="Qty"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                  /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Batch #</Label><Input aria-label="Batch #"
                    placeholder="Batch #"
                    value={line.batchNumber}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, batchNumber: e.target.value } : x)))}
                  /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Expiry date</Label><Input
                    type="date"
                    aria-label="Expiry date"
                    value={line.expiryDate}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, expiryDate: e.target.value } : x)))}
                  /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Notes</Label><Input aria-label="Notes"
                    placeholder="Notes"
                    value={line.notes}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x)))}
                  /></div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setLines((p) => [...p, { catalogueId: "", ctnId: "", quantity: "", batchNumber: "", expiryDate: "", notes: "" }])
                }
              >
                Add line
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                disabled={createMutation.isPending}
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
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit for Approval"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
