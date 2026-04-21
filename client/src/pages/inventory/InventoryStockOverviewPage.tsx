import { InventoryShell } from "@/components/inventory/InventoryShell";
import Inventory from "@/pages/Inventory";

export default function InventoryStockOverviewPage() {
  return (
    <InventoryShell activeTab="stock-overview">
      <Inventory embedInShell />
    </InventoryShell>
  );
}
