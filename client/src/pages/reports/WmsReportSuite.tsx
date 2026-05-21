import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import * as XLSX from "xlsx";

function exportCsv(filename: string, columns: string[], rows: Array<Record<string, unknown>>) {
  const body = rows.map((row) => columns.map((col) => JSON.stringify(row[col] ?? "")).join(",")).join("\n");
  const blob = new Blob([`${columns.join(",")}\n${body}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(filename: string, rows: Array<Record<string, unknown>>) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, filename);
}

export default function WmsReportSuite(props: any) {
  const initialTab = props.initialTab ?? "movements";
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [sourceType, setSourceType] = useState("all");
  const [direction, setDirection] = useState<"all" | "in" | "out">("all");

  const sitesQuery = trpc.sites.list.useQuery();
  const movementsQuery = trpc.inventoryV2.reports.wmsStockMovements.useQuery({
    warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search: search || undefined,
    sourceType: sourceType === "all" ? undefined : sourceType,
    direction,
  });
  const ctnAgingQuery = trpc.inventoryV2.reports.ctnAging.useQuery();
  const donorQuery = trpc.inventoryV2.reports.donorContribution.useQuery({ startDate: startDate || undefined, endDate: endDate || undefined });
  const lossQuery = trpc.inventoryV2.reports.lossDamage.useQuery({ startDate: startDate || undefined, endDate: endDate || undefined });
  const kitQuery = trpc.inventoryV2.reports.kitAssemblyAudit.useQuery();

  const warehouses = useMemo(() => (sitesQuery.data ?? []).filter((s) => s.facilityType === "warehouse"), [sitesQuery.data]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">WMS Report Suite</h1>
        <p className="text-sm text-muted-foreground">Stock movements, CTN aging, donor contribution, loss/damage, and kit assembly audit.</p>
      </div>

      <div className="rounded-md border p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <div className="space-y-1">
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>End date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>Search</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="space-y-1"><Label>Source</Label><Input value={sourceType} onChange={(e) => setSourceType(e.target.value || "all")} /></div>
          <div className="space-y-1">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={(value: "all" | "in" | "out") => setDirection(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="in">In</SelectItem>
                <SelectItem value="out">Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="movements">Stock Movement Report</TabsTrigger>
          <TabsTrigger value="aging">CTN Aging Report</TabsTrigger>
          <TabsTrigger value="donor">Donor Contribution Report</TabsTrigger>
          <TabsTrigger value="loss">Loss and Damage Report</TabsTrigger>
          <TabsTrigger value="kits">Kit Assembly Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="movements" className="space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportCsv("wms-stock-movements.csv", ["date","documentRef","item","ctn","donor","warehouse","fromTo","qtyIn","qtyOut","balanceAfter","sourceType"], (movementsQuery.data ?? []) as any)}>Export CSV</Button>
            <Button variant="outline" onClick={() => exportExcel("wms-stock-movements.xlsx", (movementsQuery.data ?? []) as any)}>Export Excel</Button>
          </div>
          <div className="rounded-md border">
            <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Document ref</TableHead><TableHead>Item</TableHead><TableHead>CTN</TableHead><TableHead>Donor</TableHead><TableHead>From/To</TableHead><TableHead>Qty in</TableHead><TableHead>Qty out</TableHead><TableHead>Balance</TableHead><TableHead>Source</TableHead></TableRow></TableHeader>
              <TableBody>{(movementsQuery.data ?? []).map((row, idx) => <TableRow key={idx}><TableCell>{row.date}</TableCell><TableCell>{row.documentRef ?? "—"}</TableCell><TableCell>{row.item}</TableCell><TableCell>{row.ctn}</TableCell><TableCell>{row.donor}</TableCell><TableCell>{row.fromTo ?? "—"}</TableCell><TableCell>{row.qtyIn}</TableCell><TableCell>{row.qtyOut}</TableCell><TableCell>{row.balanceAfter}</TableCell><TableCell>{row.sourceType}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="aging" className="space-y-2">
          <Button variant="outline" onClick={() => exportCsv("wms-ctn-aging.csv", ["ctnCode","item","donor","warehouse","balance","expiryDate","daysUntilExpiry","color"], (ctnAgingQuery.data ?? []) as any)}>Export CSV</Button>
          <div className="rounded-md border">
            <Table><TableHeader><TableRow><TableHead>CTN code</TableHead><TableHead>Item</TableHead><TableHead>Donor</TableHead><TableHead>Warehouse</TableHead><TableHead>Balance</TableHead><TableHead>Expiry</TableHead><TableHead>Days</TableHead></TableRow></TableHeader>
              <TableBody>{(ctnAgingQuery.data ?? []).map((row, idx) => <TableRow key={idx}><TableCell>{row.ctnCode}</TableCell><TableCell>{row.item}</TableCell><TableCell>{row.donor}</TableCell><TableCell>{row.warehouse}</TableCell><TableCell>{row.balance}</TableCell><TableCell>{row.expiryDate ?? "—"}</TableCell><TableCell className={row.color === "red" ? "text-red-600" : row.color === "amber" ? "text-amber-600" : "text-green-600"}>{row.daysUntilExpiry ?? "—"}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="donor" className="space-y-2">
          <Button variant="outline" onClick={() => exportExcel("wms-donor-contribution.xlsx", (donorQuery.data ?? []) as any)}>Export Excel</Button>
          <div className="rounded-md border">
            <Table><TableHeader><TableRow><TableHead>Donor</TableHead><TableHead>Item</TableHead><TableHead>Total units received</TableHead><TableHead>Total distributed</TableHead><TableHead>In stock</TableHead><TableHead>% distributed</TableHead></TableRow></TableHeader>
              <TableBody>{(donorQuery.data ?? []).map((row, idx) => <TableRow key={idx}><TableCell>{row.donor}</TableCell><TableCell>{row.item}</TableCell><TableCell>{row.received}</TableCell><TableCell>{row.distributed}</TableCell><TableCell>{row.inStock}</TableCell><TableCell>{row.percentDistributed.toFixed(2)}%</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="loss" className="space-y-2">
          <Button variant="outline" onClick={() => exportCsv("wms-loss-damage.csv", ["date","item","ctn","donor","warehouse","qty","sourceType","documentRef","reason"], (lossQuery.data ?? []) as any)}>Export CSV</Button>
          <div className="rounded-md border">
            <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>CTN</TableHead><TableHead>Donor</TableHead><TableHead>Warehouse</TableHead><TableHead>Qty</TableHead><TableHead>Source</TableHead><TableHead>Document ref</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
              <TableBody>{(lossQuery.data ?? []).map((row, idx) => <TableRow key={idx}><TableCell>{row.date}</TableCell><TableCell>{row.item}</TableCell><TableCell>{row.ctn}</TableCell><TableCell>{row.donor}</TableCell><TableCell>{row.warehouse}</TableCell><TableCell>{row.qty}</TableCell><TableCell>{row.sourceType}</TableCell><TableCell>{row.documentRef ?? "—"}</TableCell><TableCell>{row.reason ?? "—"}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="kits" className="space-y-2">
          <div className="rounded-md border">
            <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Kit item</TableHead><TableHead>Kit CTN</TableHead><TableHead>Qty assembled</TableHead><TableHead>Contributing CTNs and donors</TableHead><TableHead>Assembler</TableHead></TableRow></TableHeader>
              <TableBody>{(kitQuery.data ?? []).map((row, idx) => <TableRow key={idx}><TableCell>{row.date}</TableCell><TableCell>{row.kitItem}</TableCell><TableCell>{row.kitCtn}</TableCell><TableCell>{row.qtyAssembled}</TableCell><TableCell>{row.contributingCtnAndDonor}</TableCell><TableCell>{row.assemblerName ?? "—"}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

