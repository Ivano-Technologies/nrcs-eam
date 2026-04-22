import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";

export default function Movements({ embedInShell = false }: { embedInShell?: boolean } = {}) {
  const [warehouseId, setWarehouseId] = useState("all");
  const [type, setType] = useState("all");
  const [itemId, setItemId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: sites } = trpc.sites.list.useQuery();
  const warehouses = useMemo(() => (sites ?? []).filter((x) => x.facilityType === "warehouse"), [sites]);
  const { data: catalogue } = trpc.inventoryV2.catalogue.list.useQuery();
  const movements = trpc.inventoryV2.movements.list.useQuery({
    warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
    itemId: itemId === "all" ? undefined : Number(itemId),
    type: type === "all" ? undefined : (type as any),
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
  });

  const exportCsv = () => {
    const rows = movements.data ?? [];
    const header = "Date,Type,Item,From,To,Quantity,Balance After,Document\n";
    const body = rows
      .map((r) =>
        [
          r.createdAt ? new Date(r.createdAt).toISOString() : "",
          r.movementType,
          `${r.itemCode} ${r.itemName}`.replaceAll(",", " "),
          r.fromWarehouseId ?? "",
          r.toWarehouseId ?? "",
          r.quantityChange,
          r.balanceAfter,
          r.documentNumber ?? "",
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-movements-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {!embedInShell ? (
        <>
          <h1 className="text-3xl font-bold">Inventory Movements</h1>
          <InventorySecondaryNav />
        </>
      ) : null}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-4">
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Warehouse" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All warehouses</SelectItem>
              {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={itemId} onValueChange={setItemId}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Item" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All items</SelectItem>
              {(catalogue ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.itemCode} - {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="receipt">Receipt</SelectItem>
              <SelectItem value="issue">Issue</SelectItem>
              <SelectItem value="transfer_out">Transfer Out</SelectItem>
              <SelectItem value="transfer_in">Transfer In</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[180px]" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[180px]" />
          <Button variant="outline" className="ml-auto" onClick={exportCsv}>Export to Excel</Button>
        </CardContent>
      </Card>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Type</th>
              <th className="px-2 py-2 text-left">Item</th>
              <th className="px-2 py-2 text-left">From</th>
              <th className="px-2 py-2 text-left">To</th>
              <th className="px-2 py-2 text-right">Quantity</th>
              <th className="px-2 py-2 text-right">Balance After</th>
              <th className="px-2 py-2 text-left">Document</th>
            </tr>
          </thead>
          <tbody>
            {(movements.data ?? []).map((row) => (
              <tr key={row.id} className="border-b">
                <td className="px-2 py-2">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</td>
                <td className="px-2 py-2">{row.movementType}</td>
                <td className="px-2 py-2">{row.itemCode} - {row.itemName}</td>
                <td className="px-2 py-2">{row.fromWarehouseId ?? "—"}</td>
                <td className="px-2 py-2">{row.toWarehouseId ?? "—"}</td>
                <td className="px-2 py-2 text-right">{row.quantityChange}</td>
                <td className="px-2 py-2 text-right">{row.balanceAfter}</td>
                <td className="px-2 py-2">{row.documentNumber ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
