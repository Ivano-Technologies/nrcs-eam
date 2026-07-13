import { useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Warehouse, FileDown } from "lucide-react";
import { downloadBase64File } from "@/lib/download";
import { toast } from "sonner";

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

export default function WmsReportSuite(props: any) {
  const initialTab = props.initialTab ?? "movements";
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [sourceType, setSourceType] = useState("all");
  const [direction, setDirection] = useState<"all" | "in" | "out">("all");
  const [donorId, setDonorId] = useState<string>("");
  const [statementFrom, setStatementFrom] = useState("");
  const [statementTo, setStatementTo] = useState("");

  const exportReportMutation = trpc.inventoryV2.reports.exportReport.useMutation();

  async function downloadExcel(filename: string, rows: Array<Record<string, unknown>>) {
    const result = await exportReportMutation.mutateAsync({ rows, filename, sheetName: "Report" });
    const blob = new Blob(
      [Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

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
  const donorsQuery = trpc.wms.ctn.donors.useQuery();
  const donorStatementQuery = trpc.inventoryV2.reports.donorStatement.useQuery(
    {
      donorId: Number(donorId),
      from: statementFrom || undefined,
      to: statementTo || undefined,
    },
    { enabled: !!donorId }
  );
  const donorStatementPdf = trpc.inventoryV2.reports.donorStatementPdf.useMutation({
    onSuccess: (r) => {
      downloadBase64File(r.data, r.filename, r.mimeType);
      toast.success("Donor statement PDF downloaded");
    },
    onError: (e) => toast.error(e.message),
  });
  const lossQuery = trpc.inventoryV2.reports.lossDamage.useQuery({ startDate: startDate || undefined, endDate: endDate || undefined });
  const kitQuery = trpc.inventoryV2.reports.kitAssemblyAudit.useQuery();

  const warehouses = useMemo(() => (sitesQuery.data ?? []).filter((s) => s.facilityType === "warehouse"), [sitesQuery.data]);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Warehouse}
        title="WMS Report Suite"
        subtitle="Stock movements, CTN aging, donor contribution, loss/damage, and kit assembly audit."
      />

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
            <Button variant="outline" disabled={exportReportMutation.isPending} onClick={() => { void downloadExcel("wms-stock-movements.xlsx", (movementsQuery.data ?? []) as any); }}>Export Excel</Button>
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

        <TabsContent value="donor" className="space-y-4">
          <div className="rounded-md border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Donor accountability statement</h3>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <Label>Donor</Label>
                <Select value={donorId || "none"} onValueChange={(v) => setDonorId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select donor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select donor</SelectItem>
                    {(donorsQuery.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.code} — {d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>From</Label><Input type="date" value={statementFrom} onChange={(e) => setStatementFrom(e.target.value)} /></div>
              <div className="space-y-1"><Label>To</Label><Input type="date" value={statementTo} onChange={(e) => setStatementTo(e.target.value)} /></div>
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  disabled={!donorId || donorStatementPdf.isPending}
                  onClick={() =>
                    donorStatementPdf.mutate({
                      donorId: Number(donorId),
                      from: statementFrom || undefined,
                      to: statementTo || undefined,
                    })
                  }
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>
            {donorStatementQuery.data && !donorStatementQuery.data.reconciled ? (
              <p className="text-sm text-amber-700">
                Ledger discrepancies: {donorStatementQuery.data.discrepancies.join("; ") || "Review line balances."}
              </p>
            ) : null}
            {donorId && donorStatementQuery.data ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Opening</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Distributed</TableHead>
                      <TableHead>Losses</TableHead>
                      <TableHead>Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donorStatementQuery.data.lines.map((line) => (
                      <TableRow key={line.catalogueId}>
                        <TableCell>{line.itemCode} — {line.itemName}</TableCell>
                        <TableCell>{line.openingBalance}</TableCell>
                        <TableCell>{line.received}</TableCell>
                        <TableCell>{line.distributed}</TableCell>
                        <TableCell>{line.losses}</TableCell>
                        <TableCell>{line.closingBalance}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
          <Button variant="outline" disabled={exportReportMutation.isPending} onClick={() => { void downloadExcel("wms-donor-contribution.xlsx", (donorQuery.data ?? []) as any); }}>Export contribution Excel</Button>
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

