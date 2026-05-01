import { ModuleFilterSearch, ModuleFiltersCard } from "@/components/ModuleFiltersCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";

type Props = { embedInShell?: boolean };

export default function BinCards({ embedInShell = false }: Props = {}) {
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

  return (
    <div className="space-y-4">
      {embedInShell ? <h2 className="text-2xl font-bold">Bin Cards</h2> : null}
      <ModuleFiltersCard filterRow={<ModuleFilterSearch placeholder="Search bin cards..." value={search} onChange={(e) => setSearch(e.target.value)} />} />
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
              <TableRow key={row.id} className="cursor-pointer" onClick={() => setLocation(`/app/inventory/tracking/bin-cards/${row.id}`)}>
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
    </div>
  );
}

