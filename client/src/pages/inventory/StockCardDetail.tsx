import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";

export default function StockCardDetail() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/app/inventory/tracking/stock-cards/:id");
  const id = Number(params?.id ?? 0);
  const [countedQty, setCountedQty] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [supervisorId, setSupervisorId] = useState("");

  const card = trpc.inventoryV2.stockCards.get.useQuery({ id }, { enabled: id > 0 });
  const addStockCheck = trpc.inventoryV2.stockCards.addStockCheck.useMutation({
    onSuccess: () => {
      toast.success("Stock check movement saved.");
      setCountedQty("");
      void card.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const running = useMemo(() => {
    let balance = 0;
    return (card.data?.ledger ?? []).map((row) => {
      balance += Number(row.quantityIn) - Number(row.quantityOut);
      return { ...row, runningBalance: balance };
    });
  }, [card.data?.ledger]);

  const submitStockCheck = () => {
    const qty = Number(countedQty);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error("Enter a valid counted quantity.");
      return;
    }
    addStockCheck.mutate({
      stockCardId: id,
      date,
      countedQty: qty,
      storekeeperId: 1,
      notes: notes || undefined,
      supervisorId: supervisorId ? Number(supervisorId) : undefined,
    });
  };

  if (!card.data) return <div className="p-4 text-sm text-muted-foreground">Loading stock card…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Stock Card Detail</h2>
        <Button variant="outline" onClick={() => setLocation(`/app/inventory/tracking/stock-cards/${id}/print`)}>
          Print view
        </Button>
      </div>

      <div className="grid gap-3 rounded-md border p-4 md:grid-cols-2">
        <div><span className="text-muted-foreground">Description:</span> {card.data.card.description || card.data.card.itemName}</div>
        <div><span className="text-muted-foreground">Item Code:</span> {card.data.card.itemCode || "—"}</div>
        <div><span className="text-muted-foreground">Measure Unit:</span> {card.data.card.measureUnit || "—"}</div>
        <div><span className="text-muted-foreground">CTN/Donor:</span> {card.data.card.ctnCode} / {card.data.card.donorCode}</div>
        <div><span className="text-muted-foreground">Expiry Date:</span> {card.data.card.expiryDate || "—"}</div>
        <div><span className="text-muted-foreground">Stock Minimum:</span> {card.data.card.stockMinimum ?? "—"}</div>
      </div>

      <div className="grid gap-2 rounded-md border p-4 md:grid-cols-5">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input placeholder="Counted qty" value={countedQty} onChange={(e) => setCountedQty(e.target.value)} />
        <Input placeholder="Supervisor ID (for retroactive)" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} />
        <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button onClick={submitStockCheck} disabled={addStockCheck.isPending}>
          {addStockCheck.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Add Stock Check"
          )}
        </Button>
      </div>

      <div className="frozen-table-wrap rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Document Ref</TableHead>
              <TableHead>From/To</TableHead>
              <TableHead>Store No.</TableHead>
              <TableHead className="text-right">IN</TableHead>
              <TableHead className="text-right">OUT</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead>Bin Card N°</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {running.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.sourceType === "stock_check" ? "— STOCK CHECK" : row.documentRef || "—"}</TableCell>
                <TableCell>{row.fromTo || "—"}</TableCell>
                <TableCell>{row.createdByName || "—"}</TableCell>
                <TableCell className="text-right">{row.quantityIn}</TableCell>
                <TableCell className="text-right">{row.quantityOut}</TableCell>
                <TableCell className="text-right">{row.runningBalance}</TableCell>
                <TableCell>{row.remarks || "—"}</TableCell>
                <TableCell>{row.binCardId ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

