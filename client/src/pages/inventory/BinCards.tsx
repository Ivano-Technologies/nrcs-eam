import { ModuleFilterSearch, ModuleFiltersCard } from "@/components/ModuleFiltersCard";
import { ViewToggle } from "@/components/ViewToggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMobileDefaultViewMode } from "@/hooks/useMobileDefaultViewMode";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";

type Props = { embedInShell?: boolean };

export default function BinCards({ embedInShell = false }: Props = {}) {
  const [viewMode, setViewMode] = useMobileDefaultViewMode("viewMode_bin_cards");
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const cards = trpc.inventoryV2.binCards.list.useQuery();
  const rows = (cards.data ?? []).filter((x) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [x.binNumber, x.stockLocation, x.itemCode, x.itemDescription, x.ctnDonor].some((s) =>
      String(s ?? "").toLowerCase().includes(q)
    );
  });

  const openDetail = (id: number) => setLocation(`/app/inventory/tracking/bin-cards/${id}`);

  return (
    <div className="space-y-4">
      {embedInShell ? <h2 className="text-2xl font-bold">Bin Cards</h2> : null}
      <ModuleFiltersCard
        filterRow={<ModuleFilterSearch placeholder="Search bin cards..." value={search} onChange={(e) => setSearch(e.target.value)} />}
        toolbarStart={<ViewToggle value={viewMode} onChange={setViewMode} />}
      />
      {viewMode === "card" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <Card key={row.id} className="cursor-pointer" onClick={() => openDetail(row.id)}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm">{row.binNumber}</p>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
                <p className="font-semibold">{row.itemDescription || row.itemCode || "—"}</p>
                <p className="text-sm text-muted-foreground">{row.stockLocation || "—"}</p>
                <p className="text-sm tabular-nums">Balance: {row.currentBalance}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="frozen-table-wrap rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bin number</TableHead>
                <TableHead>Stock location</TableHead>
                <TableHead>Item code</TableHead>
                <TableHead>Item description</TableHead>
                <TableHead>CTN/Donor</TableHead>
                <TableHead className="text-right">Current balance</TableHead>
                <TableHead>Storekeeper</TableHead>
                <TableHead>Opened date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => openDetail(row.id)}>
                  <TableCell>{row.binNumber}</TableCell>
                  <TableCell>{row.stockLocation || "—"}</TableCell>
                  <TableCell>{row.itemCode || "—"}</TableCell>
                  <TableCell>{row.itemDescription || "—"}</TableCell>
                  <TableCell>{row.ctnDonor || "—"}</TableCell>
                  <TableCell className="text-right">{row.currentBalance}</TableCell>
                  <TableCell>{row.storekeeper || "—"}</TableCell>
                  <TableCell>{row.openedAt ? String(row.openedAt).slice(0, 10) : "—"}</TableCell>
                  <TableCell>{row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
