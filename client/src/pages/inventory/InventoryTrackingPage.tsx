import { InventoryShell } from "@/components/inventory/InventoryShell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appPath } from "@/lib/routes";
import {
  ArrowRightLeft,
  BookText,
  ClipboardList,
  Layers,
  Package,
  RefreshCw,
  Truck,
} from "lucide-react";
import { Link } from "wouter";

const LINKS: { title: string; description: string; href: string; icon: typeof Package }[] = [
  {
    title: "Stock cards",
    description: "Per-CTN stock card ledger and stock checks.",
    href: appPath("/inventory/tracking/stock-cards"),
    icon: BookText,
  },
  {
    title: "Bin cards",
    description: "Bin-card ledger and lifecycle actions.",
    href: appPath("/inventory/tracking/bin-cards"),
    icon: BookText,
  },
  {
    title: "Movements",
    description: "Audit trail of receipts, issues, transfers, and adjustments.",
    href: appPath("/inventory/movements"),
    icon: RefreshCw,
  },
  {
    title: "Transfers",
    description: "Inter-warehouse transfer notes, dispatch, and receive.",
    href: appPath("/inventory/transfers"),
    icon: ArrowRightLeft,
  },
  {
    title: "Stock counts",
    description: "Cycle counts and variance review.",
    href: appPath("/inventory/counts"),
    icon: ClipboardList,
  },
  {
    title: "Adjustments",
    description: "Write-offs and corrections — consolidated view coming soon.",
    href: appPath("/inventory/adjustments"),
    icon: Layers,
  },
  {
    title: "Expiry",
    description: "FEFO visibility and near-expiry stock.",
    href: appPath("/inventory/expiry"),
    icon: Package,
  },
  {
    title: "Kits",
    description: "Assembly and disassembly of kit SKUs.",
    href: appPath("/inventory/kits"),
    icon: Package,
  },
  {
    title: "Distributions",
    description: "Distribution execution and impact reporting.",
    href: appPath("/inventory/distributions"),
    icon: Truck,
  },
];

export default function InventoryTrackingPage() {
  return (
    <InventoryShell activeTab="tracking">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Track inventory transactions, stock history, and material movement across locations.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((item) => (
            <Link key={item.title} href={item.href} className="block h-full rounded-lg border bg-card transition-colors hover:bg-muted/50">
              <Card className="h-full border-0 shadow-none">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <item.icon className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-base leading-tight">{item.title}</CardTitle>
                      <CardDescription className="text-xs">{item.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </InventoryShell>
  );
}
