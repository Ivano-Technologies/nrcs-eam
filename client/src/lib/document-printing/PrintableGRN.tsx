import { useMemo } from "react";
import { PrintableShell } from "./PrintableShell";

type PrintableGRNProps = {
  document: any;
  copyType?: string;
};

export function PrintableGRN({ document, copyType = "white" }: PrintableGRNProps) {
  const td = (document?.transportDetails ?? {}) as Record<string, unknown>;
  const lines = useMemo(() => (Array.isArray(document?.items) ? document.items : []), [document?.items]);

  return (
    <PrintableShell
      title="GOODS RECEIVED NOTE"
      subtitle="Accuse de Reception / Goods Received Note"
      copyType={copyType}
      showWatermark
    >
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><strong>GRN No (Numero):</strong> {document?.documentNumber ?? "—"}</div>
        <div><strong>Country code (Code pays):</strong> {String(td.countryCode ?? "NG")}</div>
        <div><strong>Delegation / Consignee Location (Lieu):</strong> {document?.toWarehouseId ?? "—"}</div>
        <div><strong>Date of arrival (Date d'arrivee):</strong> {String(td.dateOfArrival ?? "—")}</div>
        <div><strong>Received from (Recu de):</strong> {document?.referenceDocument ?? "—"}</div>
        <div><strong>Means of transport (Moyen transport):</strong> {String(td.meansOfTransport ?? "road")}</div>
      </div>

      <table className="mt-4 w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {[
              "Consignment #",
              "Description",
              "CTN",
              "No. of units",
              "Unit",
              "Weight kg",
              "Good condition",
              "Claim",
            ].map((h) => (
              <th key={h} className="border border-black px-1 py-1 text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line: any, idx: number) => (
            <tr key={idx}>
              <td className="border border-black px-1 py-1">{line.consignmentNumber ?? "—"}</td>
              <td className="border border-black px-1 py-1">{line.description ?? "—"}</td>
              <td className="border border-black px-1 py-1">{line.ctnId ?? "—"}</td>
              <td className="border border-black px-1 py-1">{line.quantity ?? line.nbOfUnits ?? "—"}</td>
              <td className="border border-black px-1 py-1">{line.unitType ?? "—"}</td>
              <td className="border border-black px-1 py-1">{line.weightKg ?? "—"}</td>
              <td className="border border-black px-1 py-1">{line.receivedInGoodCondition === false ? "No" : "Yes"}</td>
              <td className="border border-black px-1 py-1">{line.claimNotes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="min-h-28 border border-black p-2">
          <div className="font-semibold">Delivered by (Livre par)</div>
          <div>Name: {String(td.deliveredByName ?? "—")}</div>
          <div>Function: {String(td.deliveredByFunction ?? "—")}</div>
          <div>Date: {String(td.deliveredByDate ?? "—")}</div>
          <div>Signature stamp: {String(td.deliveredBySignature ?? "—")}</div>
        </div>
        <div className="min-h-28 border border-black p-2">
          <div className="font-semibold">Received by (Recu par)</div>
          <div>Name: {String(td.receivedByName ?? "—")}</div>
          <div>Function: {String(td.receivedByFunction ?? "—")}</div>
          <div>Date: {String(td.receivedByDate ?? "—")}</div>
          <div>Signature stamp: {String(td.receivedBySignature ?? "—")}</div>
        </div>
      </div>

      <div className="mt-3 text-xs">
        <strong>Comments (Commentaires):</strong> {String(td.comments ?? document?.notes ?? "—")}
      </div>
    </PrintableShell>
  );
}
