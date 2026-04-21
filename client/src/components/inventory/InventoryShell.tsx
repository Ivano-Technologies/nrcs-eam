import { appPath } from "@/lib/routes";
import type { InventoryShellTab } from "@/lib/inventoryRoutes";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TABS: { tab: InventoryShellTab; label: string; path: string }[] = [
  { tab: "stock-overview", label: "Stock Overview", path: "/inventory/stock-overview" },
  { tab: "incoming", label: "Incoming", path: "/inventory/incoming" },
  { tab: "outgoing", label: "Outgoing", path: "/inventory/outgoing" },
  { tab: "requisitions", label: "Requisitions", path: "/inventory/requisitions" },
  { tab: "transfers", label: "Transfers", path: "/inventory/transfers" },
  { tab: "stock-takes", label: "Stock Takes", path: "/inventory/stock-takes" },
  { tab: "adjustments", label: "Adjustments", path: "/inventory/adjustments" },
];

function primaryForTab(tab: InventoryShellTab): {
  label: string;
  comingSoon: boolean;
} | null {
  switch (tab) {
    case "stock-overview":
      return null;
    case "incoming":
      return { label: "New Receipt", comingSoon: true };
    case "outgoing":
      return { label: "New Issue", comingSoon: true };
    case "requisitions":
      return null;
    case "transfers":
      return null;
    case "stock-takes":
      return { label: "Start Stock Take", comingSoon: true };
    case "adjustments":
      return { label: "New Adjustment", comingSoon: true };
    default:
      return null;
  }
}

type InventoryShellProps = {
  activeTab: InventoryShellTab;
  children: React.ReactNode;
};

export function InventoryShell({ activeTab, children }: InventoryShellProps) {
  const [location] = useLocation();
  const locPath = (location.split("?")[0] || "/").replace(/\/$/, "") || "/";
  const primary = primaryForTab(activeTab);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="mt-1 text-muted-foreground">
            Humanitarian stock management for relief materials across warehouses.
          </p>
        </div>
        {primary ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0">
                  <Button className="h-9" disabled={primary.comingSoon}>
                    {primary.label}
                  </Button>
                </span>
              </TooltipTrigger>
              {primary.comingSoon ? (
                <TooltipContent side="left" className="max-w-[220px] text-xs">
                  Coming soon
                </TooltipContent>
              ) : null}
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => {
          const href = appPath(t.path);
          const h = href.replace(/\/$/, "") || "/";
          const active = locPath === h;
          return (
            <Link key={t.path} href={href}>
              <a
                className={cn(
                  "rounded-md border px-3 py-1.5 text-[13px] transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {t.label}
              </a>
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
