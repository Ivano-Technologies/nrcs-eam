import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";
import { PrintableStockCard } from "@/lib/document-printing/PrintableStockCard";

export default function StockCardPrint() {
  const [, params] = useRoute("/app/inventory/tracking/stock-cards/:id/print");
  const id = Number(params?.id ?? 0);
  const card = trpc.inventoryV2.stockCards.get.useQuery({ id }, { enabled: id > 0 });

  if (!card.data) return null;

  return <PrintableStockCard data={card.data} />;
}

