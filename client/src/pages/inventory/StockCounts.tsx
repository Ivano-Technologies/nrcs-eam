import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function StockCounts() {
  const { isManagerOrAdmin, isStaffOrAbove } = usePermissions();
  const [status, setStatus] = useState("all");
  const [warehouseId, setWarehouseId] = useState("all");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [countType, setCountType] = useState<"full" | "cycle" | "spot_check">("cycle");
  const [countId, setCountId] = useState<number | null>(null);

  const { data: sites } = trpc.sites.list.useQuery();
  const warehouses = useMemo(() => (sites ?? []).filter((x) => x.facilityType === "warehouse"), [sites]);
  const countsQuery = trpc.inventoryV2.counts.list.useQuery({
    warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
    status: status === "all" ? undefined : status,
  });
  const createMutation = trpc.inventoryV2.counts.create.useMutation({
    onSuccess: (res) => {
      setCountId(res.id);
      setStep(4);
      void countsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const generateSheet = trpc.inventoryV2.counts.generateSheet.useMutation({
    onSuccess: () => toast.success("Count sheet generated."),
    onError: (e) => toast.error(e.message),
  });
  const submitMutation = trpc.inventoryV2.counts.submitForReview.useMutation({
    onSuccess: () => {
      toast.success("Submitted for review.");
      void countsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const approveMutation = trpc.inventoryV2.counts.approve.useMutation({
    onSuccess: () => {
      toast.success("Count approved.");
      void countsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Stock Counts</h1>
      <InventorySecondaryNav />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-4">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="pending_review">Pending review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Warehouse" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All warehouses</SelectItem>
              {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {isStaffOrAbove ? (
            <Button data-testid="new-count-btn" className="ml-auto" onClick={() => { setOpen(true); setStep(1); }}>
              New Count
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="px-2 py-2 text-left">Count #</th>
              <th className="px-2 py-2 text-left">Type</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">Variance</th>
              <th className="px-2 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(countsQuery.data ?? []).map((row) => (
              <tr key={row.id} data-testid={`count-row-${row.countNumber}`} className="border-b">
                <td className="px-2 py-2 font-mono">{row.countNumber}</td>
                <td className="px-2 py-2">{row.countType}</td>
                <td className="px-2 py-2">{row.status}</td>
                <td className="px-2 py-2">{row.varianceCount ?? 0}</td>
                <td className="px-2 py-2 space-x-2">
                  {isStaffOrAbove && row.status === "in_progress" ? (
                    <Button size="sm" onClick={() => submitMutation.mutate({ countId: row.id })}>Submit</Button>
                  ) : null}
                  {isManagerOrAdmin && row.status === "pending_review" ? (
                    <Button size="sm" onClick={() => approveMutation.mutate({ countId: row.id })}>Approve All</Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Count Wizard</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((s) => (
                <Badge key={s} data-testid={`count-step-${s}`} variant={s === step ? "default" : "outline"}>{`Step ${s}`}</Badge>
              ))}
            </div>
            {step === 1 ? (
              <div className="space-y-2">
                <p>Select warehouse</p>
                <Select value={warehouseId === "all" ? "" : warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="Warehouse" /></SelectTrigger>
                  <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button onClick={() => setStep(2)}>Next</Button>
              </div>
            ) : null}
            {step === 2 ? (
              <div className="space-y-2">
                <p>Select count type</p>
                <Select value={countType} onValueChange={(v) => setCountType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="cycle">Cycle</SelectItem>
                    <SelectItem value="spot_check">Spot check</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => setStep(3)}>Next</Button>
              </div>
            ) : null}
            {step === 3 ? (
              <div className="space-y-2">
                <p>Scope</p>
                <Input value="All items" readOnly />
                <Button
                  onClick={() =>
                    createMutation.mutate({
                      warehouseId: Number(warehouseId),
                      countType,
                      scope: { mode: "all_items" },
                    })
                  }
                >
                  Generate Count Session
                </Button>
              </div>
            ) : null}
            {step === 4 && countId ? (
              <div className="space-y-2">
                <p>Review and generate count sheet</p>
                <Button onClick={() => generateSheet.mutate({ countId })}>Generate Count Sheet</Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
