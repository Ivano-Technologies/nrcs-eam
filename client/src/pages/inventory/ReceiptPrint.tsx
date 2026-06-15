import { useMemo } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { PrintableGRN } from "@/lib/document-printing/PrintableGRN";

export default function ReceiptPrint() {
  const [, params] = useRoute("/app/inventory/receipts/:id/print/:copyType");
  const id = Number(params?.id ?? 0);
  const copyType = params?.copyType ?? "white";
  const source = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const value = new URLSearchParams(window.location.search).get("source");
    return value === "legacy" ? ("legacy" as const) : value === "relational" ? ("relational" as const) : undefined;
  }, [id]);

  const q = trpc.inventoryV2.receipts.get.useQuery({ documentId: id, source }, { enabled: id > 0 });
  const doc = q.data;

  return <PrintableGRN document={doc} copyType={copyType} />;
}

