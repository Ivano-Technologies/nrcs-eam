import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { PrintableGRN } from "@/lib/document-printing/PrintableGRN";

export default function ReceiptPrint() {
  const [, params] = useRoute("/app/inventory/receipts/:id/print/:copyType");
  const id = Number(params?.id ?? 0);
  const copyType = params?.copyType ?? "white";

  const q = trpc.inventoryV2.receipts.get.useQuery({ documentId: id }, { enabled: id > 0 });
  const doc = q.data;

  return <PrintableGRN document={doc} copyType={copyType} />;
}

