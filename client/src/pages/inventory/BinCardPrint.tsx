import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";
import { PrintableBinCard } from "@/lib/document-printing/PrintableBinCard";

export default function BinCardPrint() {
  const [, params] = useRoute("/app/inventory/tracking/bin-cards/:id/print");
  const id = Number(params?.id ?? 0);
  const data = trpc.inventoryV2.binCards.get.useQuery({ id }, { enabled: id > 0 });

  if (!data.data) return null;
  return <PrintableBinCard data={data.data} />;
}

