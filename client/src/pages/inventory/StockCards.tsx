import { ModuleFilterSearch, ModuleFiltersCard } from "@/components/ModuleFiltersCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

type Props = { embedInShell?: boolean };

export default function StockCards({ embedInShell = false }: Props = {}) {
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("all");
  const [expiryWindow, setExpiryWindow] = useState<"all" | "expiring-30" | "expiring-90" | "expired">("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [, setLocation] = useLocation();

  const { data: sites } = trpc.sites.list.useQuery();
  const warehouses = useMemo(() => (sites ?? []).filter((x) => x.facilityType === "warehouse"), [sites]);

  const cards = trpc.inventoryV2.stockCards.list.useQuery({
    search: search || undefined,
    locationId: locationId === "all" ? undefined : Number(locationId),
    expiryWindow,
    lowStockOnly,
  });

  return (
    <div className="space-y-4">
      {embedInShell ? <h2 className="text-2xl font-bold">Stock Cards</h2> : null}
      <ModuleFiltersCard
        filterRow={
          <>
            <ModuleFilterSearch
              placeholder="Search item, CTN, donor code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={expiryWindow} onValueChange={(v) => setExpiryWindow(v as any)}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Expiry window" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All expiry</SelectItem>
                <SelectItem value="expiring-30">Expiring 30 days</SelectItem>
                <SelectItem value="expiring-90">Expiring 90 days</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={lowStockOnly ? "default" : "outline"}
              className="h-9"
              onClick={() => setLowStockOnly((v) => !v)}
            >
              Low stock only
            </Button>
          </>
        }
      />

      <div className="frozen-table-wrap rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item name</TableHead>
              <TableHead>CTN code</TableHead>
              <TableHead>Donor</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Current balance</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Expiry date</TableHead>
              <TableHead>Min stock flag</TableHead>
              <TableHead>Last movement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(cards.data ?? []).map((row) => (
              <TableRow
                key={row.stockCardId}
                className="cursor-pointer"
                onClick={() => setLocation(`/app/inventory/tracking/stock-cards/${row.stockCardId}`)}
              >
                <TableCell>{row.itemName}</TableCell>
                <TableCell className="font-mono">{row.ctnCode}</TableCell>
                <TableCell>{row.donorCode}</TableCell>
                <TableCell>{row.locationName}</TableCell>
                <TableCell className="text-right tabular-nums">{row.currentBalance}</TableCell>
                <TableCell>{row.unit || "—"}</TableCell>
                <TableCell>{row.expiryDate || "—"}</TableCell>
                <TableCell>{row.minStockFlag ? "YES" : "—"}</TableCell>
                <TableCell>{row.lastMovementDate || "—"}</TableCell>
              </TableRow>
            ))}
            {!cards.isLoading && (cards.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  No stock cards found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

