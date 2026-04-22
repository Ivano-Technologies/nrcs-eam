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

export default function WaybillPrint() {
  const [, params] = useRoute("/app/inventory/issues/:id/print/:copyType");
  const id = Number(params?.id ?? 0);
  const copyType = params?.copyType ?? "white";
  const meta = COPY_META[copyType] ?? COPY_META.white;

  const q = trpc.inventoryV2.waybills.get.useQuery({ id }, { enabled: id > 0 });
  const wb = q.data;
  const lines = useMemo(() => wb?.lines ?? [], [wb?.lines]);

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 text-black">
      <style>
        {`
          @page { size: A4 portrait; margin: 10mm; }
          @media print {
            .no-print { display: none !important; }
            [data-slot="sidebar"], [data-slot="sidebar-inset"] > header, footer { display: none !important; }
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
          <div className="text-lg font-bold">Waybill / Delivery Note</div>
          <div className="text-xs">Lettre de voiture / Bon de livraison</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><strong>WB No:</strong> {wb?.wbNumber ?? "—"}</div>
          <div><strong>Date:</strong> {wb?.date ?? "—"}</div>
          <div><strong>Source Warehouse:</strong> {wb?.warehouseId ?? "—"}</div>
          <div><strong>Destination:</strong> {wb?.destinationBeneficiary ?? "—"}</div>
          <div><strong>Destination Type:</strong> {wb?.destinationType ?? "—"}</div>
          <div><strong>Means of Transport:</strong> {wb?.meansOfTransport ?? "—"}</div>
        </div>

        <table className="mt-4 w-full border-collapse text-[11px]">
          <thead>
            <tr>
              {["Description", "Total units", "Unit", "CTN breakdown", "Remarks"].map((h) => (
                <th key={h} className="border border-black px-1 py-1 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="border border-black px-1 py-1">{line.itemDescription}</td>
                <td className="border border-black px-1 py-1">{line.nbOfUnits}</td>
                <td className="border border-black px-1 py-1">{line.unitType}</td>
                <td className="border border-black px-1 py-1">
                  {line.ctnSources.map((src) => `CTN ${src.ctnId}: ${src.quantity}`).join(", ")}
                </td>
                <td className="border border-black px-1 py-1">{line.remarks ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="border border-black p-2">
            <div className="font-semibold">Loaded by / Charge par</div>
            <div>Name: {wb?.loadedByName ?? "—"}</div>
            <div>Function: {wb?.loadedByFunction ?? "—"}</div>
            <div>Date: {wb?.loadedByDate ?? "—"}</div>
          </div>
          <div className="border border-black p-2">
            <div className="font-semibold">Transported by / Transporte par</div>
            <div>Name: {wb?.transportedByName ?? "—"}</div>
            <div>Function: {wb?.transportedByFunction ?? "—"}</div>
            <div>Date: {wb?.transportedByDate ?? "—"}</div>
          </div>
        </div>

        <div className="mt-3 text-xs">
          <strong>Comments / Commentaires:</strong> {wb?.comments ?? "—"}
        </div>
      </div>
    </div>
  );
}
