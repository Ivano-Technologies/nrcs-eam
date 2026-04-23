import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";

export default function BinCardPrint() {
  const [, params] = useRoute("/app/inventory/tracking/bin-cards/:id/print");
  const id = Number(params?.id ?? 0);
  const data = trpc.inventoryV2.binCards.get.useQuery({ id }, { enabled: id > 0 });

  if (!data.data) return null;
  const { card, ledger } = data.data;
  return (
    <div className="mx-auto max-w-6xl space-y-3 p-6 print:p-2">
      <h1 className="text-2xl font-bold">NHQ Bin Card</h1>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Stock Location: {card.stockLocation || "—"}</div>
        <div>CTN/Donor: {card.commodityTrackingNumber || "—"} / {card.donorCode || "—"}</div>
        <div>Unit: {card.unit || "—"}</div>
        <div>Item Code: {card.itemCode || "—"}</div>
        <div>Item Description: {card.itemDescription || "—"}</div>
        <div>Exp Date: {card.expiryDate || "—"}</div>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border p-1 text-left">Date</th>
            <th className="border p-1 text-left">From/To</th>
            <th className="border p-1 text-left">WB No.</th>
            <th className="border p-1 text-right">IN (+)</th>
            <th className="border p-1 text-right">OUT (-)</th>
            <th className="border p-1 text-right">Balance</th>
            <th className="border p-1 text-left">Initials</th>
            <th className="border p-1 text-left">Signature</th>
          </tr>
        </thead>
        <tbody>
          {ledger.map((row) => (
            <tr key={row.id}>
              <td className="border p-1">{row.date}</td>
              <td className="border p-1">{row.fromTo || "—"}</td>
              <td className="border p-1">{row.documentRef || "—"}</td>
              <td className="border p-1 text-right">{row.quantityIn}</td>
              <td className="border p-1 text-right">{row.quantityOut}</td>
              <td className="border p-1 text-right">{row.balanceAfter}</td>
              <td className="border p-1">{row.storekeeperInitials || "—"}</td>
              <td className="border p-1">{row.signatureUrl || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

