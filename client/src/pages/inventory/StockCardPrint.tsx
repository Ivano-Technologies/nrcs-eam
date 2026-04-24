import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";
import { PrintableStockCard } from "@/lib/document-printing/PrintableStockCard";

export default function StockCardPrint() {
  const [, params] = useRoute("/app/inventory/tracking/stock-cards/:id/print");
  const id = Number(params?.id ?? 0);
  const card = trpc.inventoryV2.stockCards.get.useQuery({ id }, { enabled: id > 0 });

  if (!id || Number.isNaN(id)) {
    return <div className="p-6 text-sm text-red-600">Invalid stock card id.</div>;
  }

  if (card.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading stock card print view...</div>;
  }

  if (!card.data) {
    return <div className="p-6 text-sm text-red-600">Stock card not found.</div>;
  }

  return <PrintableStockCard data={card.data} />;
}

