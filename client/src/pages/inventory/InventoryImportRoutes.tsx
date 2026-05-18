import ImportDraftsPage from "@/pages/inventory/ImportDraftsPage";
import ImportPage from "@/pages/inventory/ImportPage";

/** Standalone import pipeline — not the inventory tracking hub (`/inventory/tracking`). */
export function InventoryImportPageRoute() {
  return <ImportPage />;
}

export function InventoryImportDraftsRoute() {
  return <ImportDraftsPage />;
}

