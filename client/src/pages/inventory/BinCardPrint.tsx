import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";
import { PrintableBinCard } from "@/lib/document-printing/PrintableBinCard";

export default function BinCardPrint() {
  const [, params] = useRoute("/app/inventory/tracking/bin-cards/:id/print");
  const id = Number(params?.id ?? 0);
  const data = trpc.inventoryV2.binCards.get.useQuery({ id }, { enabled: id > 0 });

  if (!id || Number.isNaN(id)) {
    return <div className="p-6 text-sm text-red-600">Invalid bin card id.</div>;
  }

  if (data.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading bin card print view...</div>;
  }

  if (!data.data) {
    return <div className="p-6 text-sm text-red-600">Bin card not found.</div>;
  }

  return <PrintableBinCard data={data.data} />;
}

