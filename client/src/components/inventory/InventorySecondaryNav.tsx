import { Link, useLocation, useSearch } from "wouter";
import { appPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Stock overview", path: appPath("/inventory/stock-overview") },
  { label: "Catalogue", path: appPath("/inventory/stock-overview?tab=catalogue") },
  { label: "Inventory tracking", path: appPath("/inventory/tracking") },
  { label: "Order fulfillment", path: appPath("/inventory/requisitions") },
  { label: "Receiving", path: appPath("/inventory/receipts") },
  { label: "Shipping / Tracking", path: appPath("/inventory/issues") },
  { label: "Movements", path: appPath("/inventory/movements") },
  { label: "Transfers", path: appPath("/inventory/transfers") },
  { label: "Stock counts", path: appPath("/inventory/counts") },
  { label: "Expiry", path: appPath("/inventory/expiry") },
  { label: "Distributions", path: appPath("/inventory/distributions") },
  { label: "Kits", path: appPath("/inventory/kits") },
];

export function InventorySecondaryNav() {
  const [location] = useLocation();
  const search = useSearch();
  const tab = new URLSearchParams(search).get("tab");
  const pathOnly = location.replace(/\/$/, "") || "/";
  const stockBase = appPath("/inventory/stock-overview").replace(/\/$/, "") || "/";

  return (
    <div className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const basePath = (link.path.split("?")[0] || "/").replace(/\/$/, "") || "/";
        let active = pathOnly === basePath || pathOnly.startsWith(`${basePath}/`);
        if (basePath === stockBase) {
          if (link.label === "Stock overview") {
            active = pathOnly === stockBase && tab !== "catalogue" && tab !== "settings";
          }
          if (link.label === "Catalogue") {
            active = pathOnly === stockBase && tab === "catalogue";
          }
        }
        return (
          <Link
            key={link.label}
            href={link.path}
            className={cn(
              "rounded-md border px-3 py-1.5 text-[13px] transition-colors",
              active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
