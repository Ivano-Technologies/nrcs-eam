import { PrintableShell } from "./PrintableShell";

type PrintableBinCardProps = {
  data: any;
};

export function PrintableBinCard({ data }: PrintableBinCardProps) {
  const card = data?.card;
  const ledger = data?.ledger ?? [];
  return (
    <PrintableShell title="NIGERIAN RED CROSS SOCIETY NATIONAL HEADQUARTERS" subtitle="BIN CARD / Fiche de Bac">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Stock Location: {card?.stockLocation || "—"}</div>
        <div>CTN/Donor: {card?.commodityTrackingNumber || "—"} / {card?.donorCode || "—"}</div>
        <div>Unit: {card?.unit || "—"}</div>
        <div>Item Code: {card?.itemCode || "—"}</div>
        <div>Item Description: {card?.itemDescription || "—"}</div>
        <div>Exp Date: {card?.expiryDate || "—"}</div>
      </div>
      <table className="mt-3 w-full border-collapse text-sm">
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
          {ledger.map((row: any) => (
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
    </PrintableShell>
  );
}
