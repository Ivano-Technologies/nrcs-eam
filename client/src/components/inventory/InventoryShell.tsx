import { appPath } from "@/lib/routes";
import type { InventoryShellTab } from "@/lib/inventoryRoutes";
import { locationMatchesInventoryTracking } from "@/lib/inventoryTrackingNav";
import { Link, useLocation } from "wouter";
import PageHeader from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import { Boxes } from "lucide-react";

const DEFAULT_SUBTITLE =
  "Humanitarian inventory management system for tracking relief materials across NRCS warehouses nationwide.";

const TAB_DESCRIPTIONS: Partial<Record<InventoryShellTab, string>> = {
  "stock-overview":
    "Real-time visibility into inventory levels, stock movements, and warehouse availability.",
  tracking:
    "Track stock movements, inter-warehouse transfers, periodic counts, expiry, kits, and warehouse activity.",
  "ctn-registry":
    "Centralized registry for recording, monitoring, and validating consignment tracking numbers.",
  requisitions:
    "Manage inventory requests, picking, packing, and dispatch operations for relief distribution.",
  receipts:
    "Record and verify incoming stock deliveries, warehouse receipts, and inventory intake processes.",
  issues:
    "Track outbound shipments, delivery status, and logistics movement across distribution channels.",
};

const TABS: { tab: InventoryShellTab; label: string; path: string }[] = [
  { tab: "stock-overview", label: "Stock overview", path: "/inventory/stock-overview" },
  { tab: "tracking", label: "Inventory tracking", path: "/inventory/tracking" },
  { tab: "ctn-registry", label: "CTN registry", path: "/inventory/ctn-registry" },
  { tab: "requisitions", label: "Order fulfillment", path: "/inventory/requisitions" },
  { tab: "receipts", label: "Receiving", path: "/inventory/receipts" },
  { tab: "issues", label: "Shipping / Tracking", path: "/inventory/issues" },
];

function tabHref(path: string): string {
  return appPath(path).replace(/\/$/, "") || "/";
}

function isTabActive(tab: InventoryShellTab, path: string, locPath: string): boolean {
  const href = tabHref(path);
  if (locPath === href) return true;
  if (tab === "tracking") return locationMatchesInventoryTracking(locPath);
  return false;
}

type InventoryShellProps = {
  activeTab: InventoryShellTab;
  children: React.ReactNode;
};

export function InventoryShell({ activeTab, children }: InventoryShellProps) {
  const [location] = useLocation();
  const locPath = (location.split("?")[0] || "/").replace(/\/$/, "") || "/";

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Boxes}
        title="Inventory"
        subtitle={TAB_DESCRIPTIONS[activeTab] ?? DEFAULT_SUBTITLE}
        className="mb-0"
      />

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => {
          const href = tabHref(t.path);
          const active = isTabActive(t.tab, t.path, locPath);
          return (
            <Link
              key={t.path}
              href={href}
              data-testid={`inventory-shell-tab-${t.tab}`}
              data-active={active ? "true" : "false"}
              className={cn(
                "rounded-md border px-3 py-1.5 text-[13px] transition-colors",
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
