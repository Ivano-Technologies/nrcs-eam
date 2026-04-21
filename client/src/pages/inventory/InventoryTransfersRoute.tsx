import { InventoryShell } from "@/components/inventory/InventoryShell";
import Transfers from "@/pages/inventory/Transfers";

export default function InventoryTransfersRoute() {
  return (
    <InventoryShell activeTab="transfers">
      <Transfers embedInShell />
    </InventoryShell>
  );
}
