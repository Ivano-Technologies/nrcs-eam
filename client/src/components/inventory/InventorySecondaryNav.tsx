import { Link, useLocation, useSearch } from "wouter";
import { appPath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type NavLink = { label: string; path: string };

/** At most six pills, matching the Inventory shell tabs elsewhere. */
const PRIMARY_LINKS: NavLink[] = [
  { label: "Stock overview", path: appPath("/inventory/stock-overview") },
  { label: "Inventory tracking", path: appPath("/inventory/tracking") },
  { label: "Order fulfillment", path: appPath("/inventory/requisitions") },
  { label: "Receiving", path: appPath("/inventory/receipts") },
  { label: "Shipping and tracking", path: appPath("/inventory/issues") },
  { label: "Import", path: appPath("/inventory/import") },
];

/** Everything else lives in the "More" select. */
const MORE_LINKS: NavLink[] = [
  { label: "Catalogue", path: appPath("/inventory/stock-overview?tab=catalogue") },
  { label: "CTN registry", path: appPath("/inventory/ctn-registry") },
  { label: "Movements", path: appPath("/inventory/movements") },
  { label: "Stock cards", path: appPath("/inventory/tracking/stock-cards") },
  { label: "Bin cards", path: appPath("/inventory/tracking/bin-cards") },
  { label: "Transfers", path: appPath("/inventory/transfers") },
  { label: "Stock counts", path: appPath("/inventory/counts") },
  { label: "Expiry", path: appPath("/inventory/expiry") },
  { label: "Distributions", path: appPath("/inventory/distributions") },
  { label: "Kits", path: appPath("/inventory/kits") },
  { label: "Import drafts", path: appPath("/inventory/import/drafts") },
];

function basePathOf(path: string): string {
  return (path.split("?")[0] || "/").replace(/\/$/, "") || "/";
}

/** Exactly one link is active: exact path (and catalogue tab) first, then the longest parent path. */
function activeLinkLabel(pathOnly: string, tab: string | null): string | null {
  const stockBase = basePathOf(appPath("/inventory/stock-overview"));
  if (pathOnly === stockBase) return tab === "catalogue" ? "Catalogue" : "Stock overview";
  const all = [...PRIMARY_LINKS, ...MORE_LINKS];
  const exact = all.find((l) => basePathOf(l.path) === pathOnly);
  if (exact) return exact.label;
  let best: NavLink | null = null;
  for (const l of all) {
    const b = basePathOf(l.path);
    if (pathOnly.startsWith(`${b}/`) && (!best || b.length > basePathOf(best.path).length)) best = l;
  }
  return best?.label ?? null;
}

export function InventorySecondaryNav() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const tab = new URLSearchParams(search).get("tab");
  const pathOnly = location.replace(/\/$/, "") || "/";
  const active = activeLinkLabel(pathOnly, tab);
  const activeMore = MORE_LINKS.find((l) => l.label === active);

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border pb-2" data-testid="inventory-secondary-nav">
      {PRIMARY_LINKS.map((link) => {
        const isActive = link.label === active;
        return (
          <Link
            key={link.label}
            href={link.path}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1.5 text-[13px] transition-colors",
              isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            {link.label}
          </Link>
        );
      })}
      <Select value={activeMore?.path ?? ""} onValueChange={(path) => setLocation(path)}>
        <SelectTrigger
          aria-label="More inventory pages"
          className={cn("h-[34px] w-auto min-w-[7rem] text-[13px]", activeMore && "border-primary")}
        >
          <SelectValue placeholder="More" />
        </SelectTrigger>
        <SelectContent>
          {MORE_LINKS.map((l) => (
            <SelectItem key={l.label} value={l.path}>
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
