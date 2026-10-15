import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { PrintableWaybill } from "@/lib/document-printing/PrintableWaybill";

export default function WaybillPrint() {
  const [, params] = useRoute("/app/inventory/issues/:id/print/:copyType");
  const id = Number(params?.id ?? 0);
  const copyType = params?.copyType ?? "white";

  const q = trpc.inventoryV2.waybills.get.useQuery({ id }, { enabled: id > 0 });
  const wb = q.data;
  return <PrintableWaybill waybill={wb} copyType={copyType} />;
}
