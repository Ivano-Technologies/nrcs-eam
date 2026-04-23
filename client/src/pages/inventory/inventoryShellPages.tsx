import { InventoryShell } from "@/components/inventory/InventoryShell";
import Distributions from "@/pages/inventory/Distributions";
import Expiry from "@/pages/inventory/Expiry";
import Issues from "@/pages/inventory/Issues";
import Kits from "@/pages/inventory/Kits";
import Movements from "@/pages/inventory/Movements";
import Receipts from "@/pages/inventory/Receipts";
import StockCounts from "@/pages/inventory/StockCounts";
import StockCards from "@/pages/inventory/StockCards";

export function InventoryReceiptsPage() {
  return (
    <InventoryShell activeTab="receipts">
      <Receipts embedInShell />
    </InventoryShell>
  );
}

export function InventoryIssuesPage() {
  return (
    <InventoryShell activeTab="issues">
      <Issues embedInShell />
    </InventoryShell>
  );
}

export function InventoryMovementsPage() {
  return (
    <InventoryShell activeTab="tracking">
      <Movements embedInShell />
    </InventoryShell>
  );
}

export function InventoryStockCountsPage() {
  return (
    <InventoryShell activeTab="tracking">
      <StockCounts embedInShell />
    </InventoryShell>
  );
}

export function InventoryExpiryPage() {
  return (
    <InventoryShell activeTab="tracking">
      <Expiry embedInShell />
    </InventoryShell>
  );
}

export function InventoryDistributionsPage() {
  return (
    <InventoryShell activeTab="tracking">
      <Distributions embedInShell />
    </InventoryShell>
  );
}

export function InventoryKitsPage() {
  return (
    <InventoryShell activeTab="tracking">
      <Kits embedInShell />
    </InventoryShell>
  );
}

export function InventoryStockCardsPage() {
  return (
    <InventoryShell activeTab="tracking">
      <StockCards embedInShell />
    </InventoryShell>
  );
}
