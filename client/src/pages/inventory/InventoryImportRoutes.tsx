import { InventoryShell } from "@/components/inventory/InventoryShell";
import ImportDraftsPage from "@/pages/inventory/ImportDraftsPage";
import ImportPage from "@/pages/inventory/ImportPage";

export function InventoryImportPageRoute() {
  return (
    <InventoryShell activeTab="tracking">
      <ImportPage embedInShell />
    </InventoryShell>
  );
}

export function InventoryImportDraftsRoute() {
  return (
    <InventoryShell activeTab="tracking">
      <ImportDraftsPage embedInShell />
    </InventoryShell>
  );
}

