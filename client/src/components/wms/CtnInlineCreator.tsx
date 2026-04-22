import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function CtnInlineCreator({
  open,
  onOpenChange,
  defaultReceivedDate,
  defaultQuantity,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultReceivedDate?: string;
  defaultQuantity?: string;
  onCreated: (ctn: { id: number; label: string }) => void;
}) {
  const donorsQuery = trpc.wms.ctn.donors.useQuery(undefined, { enabled: open });
  const catalogueQuery = trpc.inventoryV2.catalogue.list.useQuery(undefined, { enabled: open });
  const createMutation = trpc.wms.ctn.create.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const [ctnCode, setCtnCode] = useState("");
  const [donorId, setDonorId] = useState("");
  const [itemId, setItemId] = useState("");
  const [receivedDate, setReceivedDate] = useState(defaultReceivedDate ?? "");
  const [expiryDate, setExpiryDate] = useState("");
  const [unit, setUnit] = useState("");
  const [originalQuantity, setOriginalQuantity] = useState(defaultQuantity ?? "");
  const [notes, setNotes] = useState("");

  const wmsItems = useMemo(
    () => (catalogueQuery.data ?? []).filter((x) => x.itemCategory !== "other"),
    [catalogueQuery.data]
  );

  const onSave = async () => {
    const created = await createMutation.mutateAsync({
      ctnCode: ctnCode.trim(),
      donorId: Number(donorId),
      itemId: Number(itemId),
      receivedDate: receivedDate || undefined,
      expiryDate: expiryDate || undefined,
      unit: unit.trim(),
      originalQuantity: Number(originalQuantity),
      notes: notes || undefined,
    });
    const item = wmsItems.find((x) => x.id === created.itemId);
    onCreated({ id: created.id, label: `${created.ctnCode} — ${item?.itemCode ?? ""} ${item?.name ?? ""}` });
    toast.success("CTN created and selected.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create CTN inline</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>CTN code</Label>
            <Input value={ctnCode} onChange={(e) => setCtnCode(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Donor</Label>
            <Select value={donorId || undefined} onValueChange={setDonorId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select donor" />
              </SelectTrigger>
              <SelectContent>
                {(donorsQuery.data ?? []).map((d: { id: number; code: string; name: string }) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.code} — {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Item</Label>
            <Select
              value={itemId || undefined}
              onValueChange={(value) => {
                setItemId(value);
                const item = wmsItems.find((x) => x.id === Number(value));
                if (item?.unitOfMeasure) setUnit(item.unitOfMeasure);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {wmsItems.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>
                    {i.itemCode} — {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Received date</Label>
            <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Expiry date</Label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Unit</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Original quantity</Label>
            <Input inputMode="decimal" value={originalQuantity} onChange={(e) => setOriginalQuantity(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void onSave()}
            disabled={
              createMutation.isPending ||
              !ctnCode.trim() ||
              !donorId ||
              !itemId ||
              !unit.trim() ||
              Number(originalQuantity) <= 0
            }
          >
            Save CTN
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

