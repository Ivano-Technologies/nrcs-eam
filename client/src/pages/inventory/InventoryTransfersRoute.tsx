import { InventoryShell } from "@/components/inventory/InventoryShell";
import Transfers from "@/pages/inventory/Transfers";

export default function InventoryTransfersRoute() {
  return (
    <InventoryShell activeTab="tracking">
      <Transfers embedInShell />
    </InventoryShell>
  );
}
