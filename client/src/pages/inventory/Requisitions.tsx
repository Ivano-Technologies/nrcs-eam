import { useEffect, useMemo, useState } from "react";
import { Toolbar, ToolbarSearch } from "@/components/Toolbar";
import { InventoryShellActions } from "@/components/inventory/InventoryShell";
import { EmptyState, HtmlTableEmptyState } from "@/components/ui/EmptyState";
import { formatEnumLabel } from "@/lib/format";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import PageHeader from "@/components/ui/PageHeader";
import { ClipboardList as ClipboardListIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ViewToggle } from "@/components/ViewToggle";
import { useViewMode } from "@/hooks/useViewMode";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { toast } from "sonner";
import { downloadBase64File } from "@/lib/download";
import { Download, Loader2, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ReqLine = { catalogueId: string; quantity: string; urgency: string; notes: string };

function priorityVariant(priority?: string) {
  if (priority === "emergency") return "destructive";
  if (priority === "urgent") return "default";
  return "secondary";
}

export default function Requisitions({ embedInShell = false }: { embedInShell?: boolean } = {}) {
  const [location, setLocation] = useLocation();
  const { isAdmin } = usePermissions();
  const [viewMode, setViewMode] = useViewMode("inventory_requisitions");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [facilityId, setFacilityId] = useState("all");
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [reqPriority, setReqPriority] = useState<"emergency" | "urgent" | "routine">("routine");
  const [justification, setJustification] = useState("");
  const [incidentReference, setIncidentReference] = useState("");
  const [affectedPopulation, setAffectedPopulation] = useState("");
  const [lines, setLines] = useState<ReqLine[]>([{ catalogueId: "", quantity: "", urgency: "routine", notes: "" }]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    const st = qs.get("status");
    if (st && ["all", "submitted", "approved", "rejected", "fulfilled", "draft"].includes(st)) {
      setStatus(st);
    }
    if (qs.get("new") === "1") {
      setOpen(true);
      qs.delete("new");
      const path = window.location.pathname;
      const next = qs.toString() ? `${path}?${qs.toString()}` : path;
      setLocation(next, { replace: true });
    }
  }, [location, setLocation]);

  const { data: facilities } = trpc.sites.list.useQuery();
  const { data: catalogue } = trpc.inventoryV2.catalogue.list.useQuery();
  const utils = trpc.useUtils();
  const list = trpc.inventoryV2.requisitions.list.useQuery({
    status: status === "all" ? undefined : status,
    priority: priority === "all" ? undefined : priority,
    facilityId: facilityId === "all" ? undefined : Number(facilityId),
    search: search || undefined,
  });
  const createMutation = trpc.inventoryV2.requisitions.create.useMutation({
    onSuccess: () => {
      toast.success("Requisition created");
      setOpen(false);
      void list.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const submitMutation = trpc.inventoryV2.requisitions.submit.useMutation({ onSuccess: () => void list.refetch() });
  const approveBranchMutation = trpc.inventoryV2.requisitions.approveBranch.useMutation({ onSuccess: () => void list.refetch() });
  const approveHqMutation = trpc.inventoryV2.requisitions.approveHq.useMutation({ onSuccess: () => void list.refetch() });
  const fulfillMutation = trpc.inventoryV2.requisitions.fulfill.useMutation({
    onSuccess: (result) => {
      void list.refetch();
      toast.success(`Fulfilled. Waybill ${result.waybillNumber}`, {
        action: {
          label: "Open waybill",
          onClick: () => setLocation(`/app/inventory/issues/${result.waybillId}`),
        },
      });
    },
    onError: (e) => toast.error(e.message),
  });
  const rejectMutation = trpc.inventoryV2.requisitions.reject.useMutation({ onSuccess: () => void list.refetch() });
  const downloadPdfMutation = trpc.inventoryV2.requisitions.downloadPdf.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const downloadPdf = async (row: { id: number; reqNumber: string }) => {
    try {
      const file = await downloadPdfMutation.mutateAsync({ requisitionId: row.id });
      downloadBase64File(file.data, file.filename || `${row.reqNumber}.pdf`, file.mimeType);
      toast.success("PDF downloaded.");
    } catch {
      // handled by mutation
    }
  };

  const warehouses = useMemo(() => (facilities ?? []).filter((f) => f.facilityType === "warehouse"), [facilities]);

  const handleFulfill = async (requisitionId: number) => {
    try {
      const suggested = await utils.inventoryV2.requisitions.suggestWarehouse.fetch({ requisitionId });
      const fromWarehouseId = suggested?.id ?? warehouses[0]?.id;
      if (!fromWarehouseId) {
        toast.error("No warehouse available for fulfilment.");
        return;
      }
      await fulfillMutation.mutateAsync({ requisitionId, fromWarehouseId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fulfilment failed.";
      toast.error(message);
    }
  };

  const newRequisitionButton = (
    <Button className="h-9" data-testid="new-req-btn" onClick={() => setOpen(true)}>
      New requisition
    </Button>
  );

  return (
    <div className="space-y-6">
      <InventoryShellActions>{newRequisitionButton}</InventoryShellActions>
      {!embedInShell ? (
        <>
          <PageHeader icon={ClipboardListIcon} title="Order fulfilment" actions={newRequisitionButton} />
          <InventorySecondaryNav />
        </>
      ) : null}
      <Toolbar
        filters={
          <>
            <ToolbarSearch placeholder="Search requisitions" aria-label="Search requisitions" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["draft", "submitted", "branch_approved", "hq_approved", "fulfilled", "rejected", "cancelled"].map((s) => (
                  <SelectItem key={s} value={s}>{formatEnumLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priority</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="routine">Routine</SelectItem>
              </SelectContent>
            </Select>
            <Select value={facilityId} onValueChange={setFacilityId}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Requesting facility" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All facilities</SelectItem>
                {(facilities ?? []).map((f) => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
        end={<ViewToggle value={viewMode} onChange={setViewMode} />}
      />

      {viewMode === "card" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {!list.isLoading && (list.data ?? []).length === 0 ? (
            <Card className="col-span-full">
              <EmptyState icon={ClipboardListIcon} title="No requisitions yet" />
            </Card>
          ) : null}
          {(list.data ?? []).map((row) => (
            <Card size="sm" key={row.id} data-testid={`req-row-${row.reqNumber}`}>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm">{row.reqNumber}</p>
                  <Badge data-testid="req-priority-badge" data-priority={row.priority ?? "routine"} variant={priorityVariant(row.priority ?? undefined) as any}>{formatEnumLabel(row.priority)}</Badge>
                </div>
                <p className="font-semibold">{row.title}</p>
                <p className="text-xs text-muted-foreground">{formatEnumLabel(row.status)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div
          className="frozen-table-wrap rounded-md border"
          style={
            {
              "--col1-width": "140px",
              "--col2-width": "260px",
            } as Record<string, string>
          }
        >
          <table
            className="min-w-[980px] w-full text-sm"
          >
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-2 py-2 text-left">Requisition no.</th>
                <th className="px-2 py-2 text-left">Title</th>
                <th className="px-2 py-2 text-left">Priority</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Facility</th>
                <th className="px-2 py-2 text-left">Items</th>
                <th className="px-2 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((row) => (
                <tr key={row.id} data-testid={`req-row-${row.reqNumber}`} className="border-b">
                  <td className="px-2 py-2 font-mono">{row.reqNumber}</td>
                  <td className="px-2 py-2">{row.title}</td>
                  <td className="px-2 py-2">
                    <Badge data-testid="req-priority-badge" data-priority={row.priority ?? "routine"} variant={priorityVariant(row.priority ?? undefined) as any}>{formatEnumLabel(row.priority)}</Badge>
                  </td>
                  <td className="px-2 py-2">{formatEnumLabel(row.status)}</td>
                  <td className="px-2 py-2">{row.requestingFacility}</td>
                  <td className="px-2 py-2">{Array.isArray(row.items) ? row.items.length : 0}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2 whitespace-nowrap" data-testid="req-row-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      className="hidden md:inline-flex"
                      onClick={() => void downloadPdf(row)}
                      disabled={downloadPdfMutation.isPending}
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
                    {row.status === "draft" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={submitMutation.isPending && submitMutation.variables?.requisitionId === row.id}
                        onClick={() => submitMutation.mutate({ requisitionId: row.id })}
                      >
                        {submitMutation.isPending && submitMutation.variables?.requisitionId === row.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting…
                          </>
                        ) : (
                          "Submit"
                        )}
                      </Button>
                    ) : null}
                    {row.status === "submitted" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="req-approve-branch-btn"
                        disabled={approveBranchMutation.isPending && approveBranchMutation.variables?.requisitionId === row.id}
                        onClick={() => approveBranchMutation.mutate({ requisitionId: row.id })}
                      >
                        {approveBranchMutation.isPending && approveBranchMutation.variables?.requisitionId === row.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Approving…
                          </>
                        ) : (
                          "Approve branch"
                        )}
                      </Button>
                    ) : null}
                    {row.status === "branch_approved" && isAdmin ? (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="req-approve-hq-btn"
                        disabled={approveHqMutation.isPending && approveHqMutation.variables?.requisitionId === row.id}
                        onClick={() => approveHqMutation.mutate({ requisitionId: row.id })}
                      >
                        {approveHqMutation.isPending && approveHqMutation.variables?.requisitionId === row.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Approving…
                          </>
                        ) : (
                          "Approve HQ"
                        )}
                      </Button>
                    ) : null}
                    {row.status === "hq_approved" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={fulfillMutation.isPending && fulfillMutation.variables?.requisitionId === row.id}
                        onClick={() => void handleFulfill(row.id)}
                      >
                        {fulfillMutation.isPending && fulfillMutation.variables?.requisitionId === row.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Fulfilling…
                          </>
                        ) : (
                          "Fulfil"
                        )}
                      </Button>
                    ) : null}
                    {["submitted", "branch_approved", "hq_approved"].includes(String(row.status)) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="req-reject-btn"
                        disabled={rejectMutation.isPending && rejectMutation.variables?.requisitionId === row.id}
                        onClick={() => {
                          const reason = window.prompt("Enter rejection reason");
                          if (reason) rejectMutation.mutate({ requisitionId: row.id, reason });
                        }}
                      >
                        {rejectMutation.isPending && rejectMutation.variables?.requisitionId === row.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Rejecting…
                          </>
                        ) : (
                          "Reject"
                        )}
                      </Button>
                    ) : null}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-9 md:hidden"
                          aria-label={`More actions for ${row.reqNumber}`}
                          title="More actions"
                          data-testid="req-more-btn"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={downloadPdfMutation.isPending}
                          onSelect={() => void downloadPdf(row)}
                          data-testid="req-download-pdf-item"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
              {!list.isLoading && (list.data ?? []).length === 0 ? (
                <HtmlTableEmptyState
                  colSpan={7}
                  icon={ClipboardListIcon}
                  title="No requisitions yet"
                />
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>New requisition</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            <Label>Requesting facility</Label>
            <Select value={facilityId === "all" ? "" : facilityId} onValueChange={setFacilityId}>
              <SelectTrigger><SelectValue placeholder="Select facility" /></SelectTrigger>
              <SelectContent>{(facilities ?? []).map((f) => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}</SelectContent>
            </Select>
            <Label>Priority</Label>
            <Select value={reqPriority} onValueChange={(v) => setReqPriority(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="routine">Routine</SelectItem>
              </SelectContent>
            </Select>
            <Label>Incident reference</Label>
            <Input value={incidentReference} onChange={(e) => setIncidentReference(e.target.value)} />
            <Label>Affected population</Label>
            <Input value={affectedPopulation} onChange={(e) => setAffectedPopulation(e.target.value)} />
            <Label>Justification</Label>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} />
            <Label>Line items</Label>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-4" data-testid={`req-line-${idx}`}>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Item</Label><Select value={line.catalogueId} onValueChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, catalogueId: v } : x)))}>
                  <SelectTrigger aria-label="Item"><SelectValue placeholder="Item" /></SelectTrigger>
                  <SelectContent>{(catalogue ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.itemCode} · {c.name}</SelectItem>)}</SelectContent>
                </Select></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Qty</Label><Input aria-label="Qty" placeholder="Qty" value={line.quantity} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Urgency</Label><Select value={line.urgency} onValueChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, urgency: v } : x)))}>
                  <SelectTrigger aria-label="Urgency"><SelectValue placeholder="Urgency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                  </SelectContent>
                </Select></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Notes</Label><Input aria-label="Notes" placeholder="Notes" value={line.notes} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x)))} /></div>
              </div>
            ))}
            <Button variant="outline" onClick={() => setLines((p) => [...p, { catalogueId: "", quantity: "", urgency: "routine", notes: "" }])}>Add item</Button>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                disabled={createMutation.isPending}
                onClick={() =>
                  createMutation.mutate({
                    title,
                    priority: reqPriority,
                    requestingFacility: Number(facilityId),
                    justification,
                    incidentReference: incidentReference || undefined,
                    affectedPopulation: affectedPopulation ? Number(affectedPopulation) : undefined,
                    items: lines.filter((x) => x.catalogueId && Number(x.quantity) > 0).map((x) => ({
                      catalogueId: Number(x.catalogueId),
                      quantity: Number(x.quantity),
                      urgency: x.urgency,
                      notes: x.notes || undefined,
                    })),
                  })
                }
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save as draft"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
