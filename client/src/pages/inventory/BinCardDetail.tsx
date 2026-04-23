import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";

export default function BinCardDetail() {
  const [, params] = useRoute("/app/inventory/tracking/bin-cards/:id");
  const id = Number(params?.id ?? 0);
  const [, setLocation] = useLocation();
  const [reason, setReason] = useState("");
  const data = trpc.inventoryV2.binCards.get.useQuery({ id }, { enabled: id > 0 });
  const close = trpc.inventoryV2.binCards.close.useMutation({
    onSuccess: () => {
      toast.success("Bin card closed.");
      void data.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const reopen = trpc.inventoryV2.binCards.reopen.useMutation({
    onSuccess: () => {
      toast.success("Bin card reopened.");
      setReason("");
      void data.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!data.data) return <div className="p-4 text-sm text-muted-foreground">Loading bin card…</div>;

  const { card, ledger } = data.data;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Bin Card Detail</h2>
        <Button variant="outline" onClick={() => setLocation(`/app/inventory/tracking/bin-cards/${id}/print`)}>
          Print view
        </Button>
      </div>
      <div className="grid gap-2 rounded-md border p-4 md:grid-cols-2">
        <div>Stock Location: {card.stockLocation || "—"}</div>
        <div>CTN/Donor: {card.commodityTrackingNumber || "—"} / {card.donorCode || "—"}</div>
        <div>Unit: {card.unit || "—"}</div>
        <div>Item Code: {card.itemCode || "—"}</div>
        <div>Item Description: {card.itemDescription || "—"}</div>
        <div>Exp Date: {card.expiryDate || "—"}</div>
      </div>
      <div className="flex items-center gap-2">
        {card.status === "open" ? (
          <Button onClick={() => close.mutate({ id, closedById: 1, notes: reason || undefined })}>Close Bin Card</Button>
        ) : (
          <>
            <Input placeholder="Reopen reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button onClick={() => reopen.mutate({ id, reopenedById: 1, reason })}>Reopen</Button>
          </>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>From/To</TableHead>
              <TableHead>WB No.</TableHead>
              <TableHead className="text-right">IN (+)</TableHead>
              <TableHead className="text-right">OUT (-)</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Initials</TableHead>
              <TableHead>Signature</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.fromTo || "—"}</TableCell>
                <TableCell>{row.documentRef || "—"}</TableCell>
                <TableCell className="text-right">{row.quantityIn}</TableCell>
                <TableCell className="text-right">{row.quantityOut}</TableCell>
                <TableCell className="text-right">{row.balanceAfter}</TableCell>
                <TableCell>{row.storekeeperInitials || "—"}</TableCell>
                <TableCell>{row.signatureUrl || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

