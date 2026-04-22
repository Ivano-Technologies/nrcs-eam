import { useState } from "react";
import { InventoryShell } from "@/components/inventory/InventoryShell";
import { ModuleFiltersCard, ModuleFilterSearch } from "@/components/ModuleFiltersCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ITEM_CATEGORY_VALUES } from "@shared/itemCategory";
import { toast } from "sonner";
import { format } from "date-fns";

const CATEGORY_LABEL: Record<string, string> = {
  food_nutrition: "Food & nutrition",
  shelter_nfi: "Shelter / NFI",
  wash: "WASH",
  medical_supplies: "Medical supplies",
  emergency_kits: "Emergency kits",
  equipment_tools: "Equipment & tools",
  other: "Other",
};

export default function CtnRegistryPage() {
  const [donorId, setDonorId] = useState<string>("all");
  const [itemCategory, setItemCategory] = useState<string>("all");
  const [expiryFrom, setExpiryFrom] = useState("");
  const [expiryTo, setExpiryTo] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    ctnCode: "",
    donorId: "",
    itemId: "",
    unit: "",
    originalQuantity: "",
    receivedDate: "",
    expiryDate: "",
    notes: "",
  });

  const listQuery = trpc.wms.ctn.list.useQuery({
    donorId: donorId === "all" ? undefined : Number(donorId),
    itemCategory:
      itemCategory === "all" ? undefined : (itemCategory as (typeof ITEM_CATEGORY_VALUES)[number]),
    expiryFrom: expiryFrom || undefined,
    expiryTo: expiryTo || undefined,
    search: search || undefined,
    limit: 100,
    offset: 0,
  });

  const donorsQuery = trpc.wms.ctn.donors.useQuery();
  const catalogueQuery = trpc.inventoryV2.catalogue.list.useQuery();

  const createMutation = trpc.wms.ctn.create.useMutation({
    onSuccess: () => {
      toast.success("CTN created");
      setCreateOpen(false);
      setForm({
        ctnCode: "",
        donorId: "",
        itemId: "",
        unit: "",
        originalQuantity: "",
        receivedDate: "",
        expiryDate: "",
        notes: "",
      });
      void listQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = listQuery.data?.items ?? [];

  return (
    <InventoryShell activeTab="ctn-registry">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Commodity tracking numbers (CTN)</h2>
          <p className="text-muted-foreground text-sm">
            One CTN per consignment. Item codes describe the product; the CTN identifies the shipment.
          </p>
        </div>

        <ModuleFiltersCard
          filterRow={
            <>
              <ModuleFilterSearch
                placeholder="Search CTN code, item code, name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-[220px]"
              />
              <Select value={donorId} onValueChange={setDonorId}>
                <SelectTrigger className="h-9 w-[200px]" data-testid="ctn-filter-donor">
                  <SelectValue placeholder="Donor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All donors</SelectItem>
                  {(donorsQuery.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name} ({d.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={itemCategory} onValueChange={setItemCategory}>
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {ITEM_CATEGORY_VALUES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c] ?? c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Expiry from</Label>
                  <Input
                    type="date"
                    className="h-9 w-[160px]"
                    value={expiryFrom}
                    onChange={(e) => setExpiryFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Expiry to</Label>
                  <Input
                    type="date"
                    className="h-9 w-[160px]"
                    value={expiryTo}
                    onChange={(e) => setExpiryTo(e.target.value)}
                  />
                </div>
              </div>
            </>
          }
          toolbarEnd={
            <Button className="h-9" onClick={() => setCreateOpen(true)} data-testid="ctn-create-open">
              New CTN
            </Button>
          }
        />

        <span className="text-muted-foreground text-xs">
          Filter by expiry window (optional). Current balance uses ledger movements when present; otherwise
          original quantity.
        </span>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CTN code</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Donor</TableHead>
                <TableHead className="text-right">Original qty</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Current balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    No CTNs match your filters. Seed donors (`pnpm exec tsx scripts/db/seed-wms-donors.ts`) then
                    create a CTN.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} data-testid={`ctn-row-${r.ctnCode}`}>
                    <TableCell className="font-mono text-sm">{r.ctnCode}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.itemName}</div>
                      <div className="text-muted-foreground text-xs">{r.itemCode}</div>
                    </TableCell>
                    <TableCell>
                      {r.donorName}
                      <span className="text-muted-foreground text-xs"> · {r.donorCode}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.originalQuantity} {r.unit}
                    </TableCell>
                    <TableCell>
                      {r.receivedDate ? format(new Date(r.receivedDate), "yyyy-MM-dd") : "—"}
                    </TableCell>
                    <TableCell>
                      {r.expiryDate ? format(new Date(r.expiryDate), "yyyy-MM-dd") : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.currentBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                      {r.unit}
                    </TableCell>
                    <TableCell className="capitalize">{r.status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create CTN (manual)</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="ctn-code">CTN code *</Label>
                <Input
                  id="ctn-code"
                  value={form.ctnCode}
                  onChange={(e) => setForm((f) => ({ ...f, ctnCode: e.target.value }))}
                  placeholder="e.g. 10-0001456"
                />
              </div>
              <div className="space-y-1">
                <Label>Donor *</Label>
                <Select
                  value={form.donorId}
                  onValueChange={(v) => setForm((f) => ({ ...f, donorId: v }))}
                >
                  <SelectTrigger data-testid="ctn-form-donor">
                    <SelectValue placeholder="Select donor" />
                  </SelectTrigger>
                  <SelectContent>
                    {(donorsQuery.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name} ({d.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Catalogue item *</Label>
                <Select
                  value={form.itemId}
                  onValueChange={(v) => setForm((f) => ({ ...f, itemId: v }))}
                >
                  <SelectTrigger data-testid="ctn-form-item">
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {(catalogueQuery.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.itemCode} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="ctn-unit">Unit *</Label>
                  <Input
                    id="ctn-unit"
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    placeholder="e.g. kit, pcs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ctn-qty">Original quantity *</Label>
                  <Input
                    id="ctn-qty"
                    type="number"
                    min={0}
                    step="any"
                    value={form.originalQuantity}
                    onChange={(e) => setForm((f) => ({ ...f, originalQuantity: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="ctn-rec">Received date</Label>
                  <Input
                    id="ctn-rec"
                    type="date"
                    value={form.receivedDate}
                    onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ctn-exp">Expiry date</Label>
                  <Input
                    id="ctn-exp"
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ctn-notes">Notes</Label>
                <Input
                  id="ctn-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                CTNs created from finalized GRNs will appear here automatically in a later phase.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                data-testid="ctn-form-submit"
                onClick={() => {
                  if (!form.ctnCode.trim() || !form.donorId || !form.itemId || !form.unit.trim()) {
                    toast.error("Fill required fields");
                    return;
                  }
                  const q = Number(form.originalQuantity);
                  if (!Number.isFinite(q) || q <= 0) {
                    toast.error("Original quantity must be a positive number");
                    return;
                  }
                  createMutation.mutate({
                    ctnCode: form.ctnCode.trim(),
                    donorId: Number(form.donorId),
                    itemId: Number(form.itemId),
                    unit: form.unit.trim(),
                    originalQuantity: q,
                    receivedDate: form.receivedDate || undefined,
                    expiryDate: form.expiryDate || undefined,
                    notes: form.notes.trim() || undefined,
                  });
                }}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Saving…" : "Create CTN"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </InventoryShell>
  );
}
