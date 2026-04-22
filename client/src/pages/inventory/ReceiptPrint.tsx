import { useMemo } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const COPY_META: Record<string, { label: string; watermark: string }> = {
  white: { label: "White", watermark: "ORIGINAL" },
  green: { label: "Green", watermark: "REPORTING COPY" },
  blue: { label: "Blue", watermark: "LOGISTICS FILE" },
  yellow: { label: "Yellow", watermark: "WAREHOUSE COPY" },
};

export default function ReceiptPrint() {
  const [, params] = useRoute("/app/inventory/receipts/:id/print/:copyType");
  const id = Number(params?.id ?? 0);
  const copyType = params?.copyType ?? "white";
  const meta = COPY_META[copyType] ?? COPY_META.white;

  const q = trpc.inventoryV2.receipts.get.useQuery({ documentId: id }, { enabled: id > 0 });
  const doc = q.data;
  const td = (doc?.transportDetails ?? {}) as Record<string, unknown>;
  const lines = useMemo(() => (Array.isArray(doc?.items) ? doc!.items : []), [doc]);

  return (
    <div className="receipt-print-view mx-auto max-w-[210mm] bg-white p-6 text-black">
      <style>
        {`
          @page { size: A4 portrait; margin: 10mm; }
          @media print {
            .no-print { display: none !important; }
            [data-slot="sidebar"], [data-slot="sidebar-inset"] > header, footer { display: none !important; }
            .receipt-print-view { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
          }
        `}
      </style>
      <div className="no-print mb-4 flex justify-end">
        <Button variant="outline" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>
      <div className="relative border border-black p-4">
        <div className="pointer-events-none absolute right-3 top-2 text-xs font-semibold text-gray-500">{meta.watermark}</div>
        <div className="mb-2 text-center">
          <div className="text-lg font-bold">Goods Received Note (GRN)</div>
          <div className="text-xs">Bon de reception des marchandises</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><strong>GRN No:</strong> {doc?.documentNumber ?? "—"}</div>
          <div><strong>Country code:</strong> {String(td.countryCode ?? "NG")}</div>
          <div><strong>Delegation / Consignee Location:</strong> {doc?.toWarehouseId ?? "—"}</div>
          <div><strong>Date of arrival:</strong> {String(td.dateOfArrival ?? "—")}</div>
          <div><strong>Received from:</strong> {doc?.referenceDocument ?? "—"}</div>
          <div><strong>Means of transport:</strong> {String(td.meansOfTransport ?? "road")}</div>
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
                "Claim notes",
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
          <div className="border border-black p-2">
            <div className="font-semibold">Delivered by / Livre par</div>
            <div>Name: {String(td.deliveredByName ?? "—")}</div>
            <div>Function: {String(td.deliveredByFunction ?? "—")}</div>
            <div>Date: {String(td.deliveredByDate ?? "—")}</div>
            <div>Signature: {String(td.deliveredBySignature ?? "—")}</div>
          </div>
          <div className="border border-black p-2">
            <div className="font-semibold">Received by / Recu par</div>
            <div>Name: {String(td.receivedByName ?? "—")}</div>
            <div>Function: {String(td.receivedByFunction ?? "—")}</div>
            <div>Date: {String(td.receivedByDate ?? "—")}</div>
            <div>Signature: {String(td.receivedBySignature ?? "—")}</div>
          </div>
        </div>

        <div className="mt-3 text-xs">
          <strong>Comments / Commentaires:</strong> {String(td.comments ?? doc?.notes ?? "—")}
        </div>
      </div>
    </div>
  );
}

