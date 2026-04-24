import { useMemo } from "react";
import { PrintableShell } from "./PrintableShell";

type PrintableWaybillProps = {
  waybill: any;
  copyType?: string;
};

export function PrintableWaybill({ waybill, copyType = "white" }: PrintableWaybillProps) {
  const lines = useMemo(() => waybill?.lines ?? [], [waybill?.lines]);
  return (
    <PrintableShell
      title="WAYBILL / DELIVERY NOTE"
      subtitle="Lettre de Voiture / Bon de Livraison"
      copyType={copyType}
      showWatermark
    >
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><strong>Number (Numero):</strong> {waybill?.wbNumber ?? "—"}</div>
        <div><strong>Date:</strong> {waybill?.date ?? "—"}</div>
        <div><strong>Warehouse (Entrepot):</strong> {waybill?.warehouseId ?? "—"}</div>
        <div><strong>Type:</strong> {waybill?.destinationType ?? "—"}</div>
        <div><strong>Destination / Beneficiary:</strong> {waybill?.destinationBeneficiary ?? "—"}</div>
        <div><strong>Transport (Transport):</strong> {waybill?.meansOfTransport ?? "—"}</div>
      </div>

      <table className="mt-4 w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {["Description", "CTN/Donor", "N° Units", "Unit Type/Weight", "Weight", "Volume", "Requisition N°", "Remarks"].map((h) => (
              <th key={h} className="border border-black px-1 py-1 text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line: any) => (
            <tr key={line.id}>
              <td className="border border-black px-1 py-1">{line.itemDescription}</td>
              <td className="border border-black px-1 py-1">
                {line.ctnSources?.map((src: any) => `CTN ${src.ctnId}`).join(", ") || "—"}
              </td>
              <td className="border border-black px-1 py-1">{line.nbOfUnits}</td>
              <td className="border border-black px-1 py-1">{line.unitType ?? "—"}</td>
              <td className="border border-black px-1 py-1">{line.weightKg ?? "—"}</td>
              <td className="border border-black px-1 py-1">{line.volumeM3 ?? "—"}</td>
              <td className="border border-black px-1 py-1">{line.requisitionLineId ?? "—"}</td>
              <td className="border border-black px-1 py-1">{line.remarks ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="min-h-28 border border-black p-2">
          <div className="font-semibold">Loaded by (Charge par)</div>
          <div>Name: {waybill?.loadedByName ?? "—"}</div>
          <div>Function: {waybill?.loadedByFunction ?? "—"}</div>
          <div>Date: {waybill?.loadedByDate ?? "—"}</div>
        </div>
        <div className="min-h-28 border border-black p-2">
          <div className="font-semibold">Transported by (Transporte par)</div>
          <div>Name: {waybill?.transportedByName ?? "—"}</div>
          <div>Function: {waybill?.transportedByFunction ?? "—"}</div>
          <div>Date: {waybill?.transportedByDate ?? "—"}</div>
        </div>
      </div>

      <div className="mt-3 text-xs">
        <strong>Comments (Commentaires):</strong> {waybill?.comments ?? "—"}
      </div>
    </PrintableShell>
  );
}
