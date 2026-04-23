import { trpc } from "@/lib/trpc";
import { useMemo } from "react";
import { useRoute } from "wouter";

export default function StockCardPrint() {
  const [, params] = useRoute("/app/inventory/tracking/stock-cards/:id/print");
  const id = Number(params?.id ?? 0);
  const card = trpc.inventoryV2.stockCards.get.useQuery({ id }, { enabled: id > 0 });

  const rows = useMemo(() => {
    let balance = 0;
    return (card.data?.ledger ?? []).map((row) => {
      balance += Number(row.quantityIn) - Number(row.quantityOut);
      return { ...row, runningBalance: balance };
    });
  }, [card.data?.ledger]);

  if (!card.data) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6 print:p-2">
      <h1 className="text-2xl font-bold">IFRC Stock Card</h1>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Description: {card.data.card.description || card.data.card.itemName}</div>
        <div>Item Code: {card.data.card.itemCode || "—"}</div>
        <div>Measure Unit: {card.data.card.measureUnit || "—"}</div>
        <div>CTN/Donor: {card.data.card.ctnCode} / {card.data.card.donorCode}</div>
        <div>Expiry Date: {card.data.card.expiryDate || "—"}</div>
        <div>Stock Minimum: {card.data.card.stockMinimum ?? "—"}</div>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border p-1 text-left">Date</th>
            <th className="border p-1 text-left">Document Ref</th>
            <th className="border p-1 text-left">From/To</th>
            <th className="border p-1 text-left">Store No.</th>
            <th className="border p-1 text-right">IN</th>
            <th className="border p-1 text-right">OUT</th>
            <th className="border p-1 text-right">Balance</th>
            <th className="border p-1 text-left">Remarks</th>
            <th className="border p-1 text-left">Bin Card N°</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="border p-1">{row.date}</td>
              <td className="border p-1">{row.sourceType === "stock_check" ? "— STOCK CHECK" : row.documentRef || "—"}</td>
              <td className="border p-1">{row.fromTo || "—"}</td>
              <td className="border p-1">{row.createdByName || "—"}</td>
              <td className="border p-1 text-right">{row.quantityIn}</td>
              <td className="border p-1 text-right">{row.quantityOut}</td>
              <td className="border p-1 text-right">{row.runningBalance}</td>
              <td className="border p-1">{row.remarks || "—"}</td>
              <td className="border p-1">{row.binCardId ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

