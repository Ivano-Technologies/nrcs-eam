import { InventoryShell } from "@/components/inventory/InventoryShell";
import Requisitions from "@/pages/inventory/Requisitions";

export default function InventoryRequisitionsPage() {
  return (
    <InventoryShell activeTab="requisitions">
      <Requisitions embedInShell />
    </InventoryShell>
  );
}
