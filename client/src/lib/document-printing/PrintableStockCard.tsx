import { useMemo } from "react";
import { PrintableShell } from "./PrintableShell";

type PrintableStockCardProps = {
  data: any;
};

export function PrintableStockCard({ data }: PrintableStockCardProps) {
  const rows = useMemo(() => {
    let balance = 0;
    return (data?.ledger ?? []).map((row: any) => {
      balance += Number(row.quantityIn) - Number(row.quantityOut);
      return { ...row, runningBalance: balance };
    });
  }, [data?.ledger]);

  const card = data?.card;
  return (
    <PrintableShell title="STOCK CARD" subtitle="Fiche de Stock / Stock Card">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Description: {card?.description || card?.itemName}</div>
        <div>Item Code: {card?.itemCode || "—"}</div>
        <div>Measure Unit: {card?.measureUnit || "—"}</div>
        <div>CTN/Donor: {card?.ctnCode} / {card?.donorCode}</div>
        <div>Expiry Date: {card?.expiryDate || "—"}</div>
        <div>Stock Minimum: {card?.stockMinimum ?? "—"}</div>
      </div>
      <table className="mt-3 w-full border-collapse text-sm">
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
          {rows.map((row: any) => (
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
    </PrintableShell>
  );
}
