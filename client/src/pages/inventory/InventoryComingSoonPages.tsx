import { InventoryShell } from "@/components/inventory/InventoryShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { appPath } from "@/lib/routes";
import { Link } from "wouter";

type ComingSoonTab = "incoming" | "outgoing" | "stock-takes" | "adjustments";

const COPY: Record<
  ComingSoonTab,
  { title: string; body: string; legacy?: { href: string; label: string } }
> = {
  incoming: {
    title: "Incoming",
    body: "Goods receipts and pending GRNs will be consolidated here. Until this view ships, use the existing GRN screen.",
    legacy: { href: appPath("/inventory/receipts"), label: "Open Receipts (GRN)" },
  },
  outgoing: {
    title: "Outgoing",
    body: "Issues and distributions will be consolidated here. Until this view ships, use the existing Issues screen.",
    legacy: { href: appPath("/inventory/issues"), label: "Open Issues" },
  },
  "stock-takes": {
    title: "Stock Takes",
    body: "Physical counts and reconciliation will be consolidated here. Until this view ships, use Stock Counts.",
    legacy: { href: appPath("/inventory/counts"), label: "Open Stock Counts" },
  },
  adjustments: {
    title: "Adjustments",
    body: "Write-offs, damage, and corrections will be managed here. This module is not available yet.",
  },
};

function InventoryComingSoonBody({ tab }: { tab: ComingSoonTab }) {
  const c = COPY[tab];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{c.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{c.body}</p>
          {c.legacy ? (
            <p className="text-sm">
              <Link href={c.legacy.href} className="font-medium text-primary underline-offset-4 hover:underline">
                {c.legacy.label}
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
      <div className="overflow-x-auto rounded-md border bg-card px-2 md:px-3">
        <Table className="min-w-[640px] text-sm">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-28 text-right">Qty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                No data yet
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function InventoryIncomingPage() {
  return (
    <InventoryShell activeTab="incoming">
      <InventoryComingSoonBody tab="incoming" />
    </InventoryShell>
  );
}

export function InventoryOutgoingPage() {
  return (
    <InventoryShell activeTab="outgoing">
      <InventoryComingSoonBody tab="outgoing" />
    </InventoryShell>
  );
}

export function InventoryStockTakesPage() {
  return (
    <InventoryShell activeTab="stock-takes">
      <InventoryComingSoonBody tab="stock-takes" />
    </InventoryShell>
  );
}

export function InventoryAdjustmentsPage() {
  return (
    <InventoryShell activeTab="adjustments">
      <InventoryComingSoonBody tab="adjustments" />
    </InventoryShell>
  );
}
