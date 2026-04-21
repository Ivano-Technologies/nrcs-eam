import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ViewToggle, type ViewMode } from "@/components/ViewToggle";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { toast } from "sonner";

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

type ReqLine = { catalogueId: string; quantity: string; urgency: string; notes: string };

function priorityVariant(priority?: string) {
  if (priority === "emergency") return "destructive";
  if (priority === "urgent") return "default";
  return "secondary";
}

export default function Requisitions({ embedInShell = false }: { embedInShell?: boolean } = {}) {
  const { isAdmin } = usePermissions();
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("viewMode_inventory_requisitions") as ViewMode) || "table");
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
    localStorage.setItem("viewMode_inventory_requisitions", viewMode);
  }, [viewMode]);

  const { data: facilities } = trpc.sites.list.useQuery();
  const { data: catalogue } = trpc.inventoryV2.catalogue.list.useQuery();
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
  const fulfillMutation = trpc.inventoryV2.requisitions.fulfill.useMutation({ onSuccess: () => void list.refetch() });
  const rejectMutation = trpc.inventoryV2.requisitions.reject.useMutation({ onSuccess: () => void list.refetch() });
  const downloadPdfMutation = trpc.inventoryV2.requisitions.downloadPdf.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const warehouses = useMemo(() => (facilities ?? []).filter((f) => f.facilityType === "warehouse"), [facilities]);

  return (
    <div className="space-y-4">
      {!embedInShell ? (
        <>
          <h1 className="text-3xl font-bold">Requisitions</h1>
          <InventorySecondaryNav />
        </>
      ) : null}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-4">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {["draft", "submitted", "branch_approved", "hq_approved", "fulfilled", "rejected", "cancelled"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priority</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="routine">Routine</SelectItem>
            </SelectContent>
          </Select>
          <Select value={facilityId} onValueChange={setFacilityId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Requesting facility" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All facilities</SelectItem>
              {(facilities ?? []).map((f) => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="w-[240px]" placeholder="Search requisitions" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <Button data-testid="new-req-btn" className="ml-auto" onClick={() => setOpen(true)}>New Requisition</Button>
        </CardContent>
      </Card>

      {viewMode === "card" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(list.data ?? []).map((row) => (
            <Card key={row.id} data-testid={`req-row-${row.reqNumber}`}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm">{row.reqNumber}</p>
                  <Badge data-testid="req-priority-badge" data-priority={row.priority ?? "routine"} variant={priorityVariant(row.priority ?? undefined) as any}>{row.priority}</Badge>
                </div>
                <p className="font-semibold">{row.title}</p>
                <p className="text-xs text-muted-foreground">{row.status}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-2 py-2 text-left">Req No</th>
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
                    <Badge data-testid="req-priority-badge" data-priority={row.priority ?? "routine"} variant={priorityVariant(row.priority ?? undefined) as any}>{row.priority}</Badge>
                  </td>
                  <td className="px-2 py-2">{row.status}</td>
                  <td className="px-2 py-2">{row.requestingFacility}</td>
                  <td className="px-2 py-2">{Array.isArray(row.items) ? row.items.length : 0}</td>
                  <td className="px-2 py-2 space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const file = await downloadPdfMutation.mutateAsync({ requisitionId: row.id });
                          downloadBase64File(file.data, file.filename || `${row.reqNumber}.pdf`, file.mimeType);
                          toast.success("PDF downloaded.");
                        } catch {
                          // handled by mutation
                        }
                      }}
                      disabled={downloadPdfMutation.isPending}
                    >
                      {downloadPdfMutation.isPending ? "Generating..." : "Download PDF"}
                    </Button>
                    {row.status === "draft" ? <Button size="sm" onClick={() => submitMutation.mutate({ requisitionId: row.id })}>Submit</Button> : null}
                    {row.status === "submitted" ? <Button size="sm" data-testid="req-approve-branch-btn" onClick={() => approveBranchMutation.mutate({ requisitionId: row.id })}>Approve Branch</Button> : null}
                    {row.status === "branch_approved" && isAdmin ? <Button size="sm" data-testid="req-approve-hq-btn" onClick={() => approveHqMutation.mutate({ requisitionId: row.id })}>Approve HQ</Button> : null}
                    {row.status === "hq_approved" ? (
                      <Button size="sm" onClick={() => fulfillMutation.mutate({ requisitionId: row.id, fromWarehouseId: warehouses[0]?.id ?? 0 })}>
                        Fulfill
                      </Button>
                    ) : null}
                    {["submitted", "branch_approved", "hq_approved"].includes(String(row.status)) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="req-reject-btn"
                        onClick={() => {
                          const reason = window.prompt("Enter rejection reason");
                          if (reason) rejectMutation.mutate({ requisitionId: row.id, reason });
                        }}
                      >
                        Reject
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Create Requisition</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            <Label>Requesting Facility</Label>
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
            <Label>Incident Reference</Label>
            <Input value={incidentReference} onChange={(e) => setIncidentReference(e.target.value)} />
            <Label>Affected Population</Label>
            <Input value={affectedPopulation} onChange={(e) => setAffectedPopulation(e.target.value)} />
            <Label>Justification</Label>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} />
            <Label>Line items</Label>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-2">
                <Select value={line.catalogueId} onValueChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, catalogueId: v } : x)))}>
                  <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                  <SelectContent>{(catalogue ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.itemCode} - {c.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Qty" value={line.quantity} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))} />
                <Select value={line.urgency} onValueChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, urgency: v } : x)))}>
                  <SelectTrigger><SelectValue placeholder="Urgency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Notes" value={line.notes} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x)))} />
              </div>
            ))}
            <Button variant="outline" onClick={() => setLines((p) => [...p, { catalogueId: "", quantity: "", urgency: "routine", notes: "" }])}>Add Item</Button>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
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
                Save as Draft
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
