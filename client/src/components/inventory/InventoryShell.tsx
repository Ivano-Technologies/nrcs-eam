import { appPath } from "@/lib/routes";
import type { InventoryShellTab } from "@/lib/inventoryRoutes";
import { locationMatchesInventoryTracking } from "@/lib/inventoryTrackingNav";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

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
  void activeTab;
  const [location] = useLocation();
  const locPath = (location.split("?")[0] || "/").replace(/\/$/, "") || "/";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="mt-1 text-muted-foreground">
            Humanitarian stock management for relief materials across warehouses.
          </p>
        </div>
      </div>

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
