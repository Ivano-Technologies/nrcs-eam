import { useMemo, useState } from "react";
import { Link } from "wouter";
import PageHeader from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/EmptyState";
import { trpc } from "@/lib/trpc";
import { ExportMenu } from "@/components/ExportMenu";
import { ArrowLeftRight, Boxes, CalendarClock, FileBarChart, FileDown, HandHeart, ScanLine, ShieldAlert, Warehouse } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { downloadBase64File } from "@/lib/download";
import { useMobileTableColumns, MobileColumnsToggle, mobileSecondaryCol } from "@/hooks/useMobileTableColumns";
import { cn } from "@/lib/utils";
import { appPath } from "@/lib/routes";
import { DATE_INPUT_HINT, formatDate, formatEnumLabel } from "@/lib/format";
import { toast } from "sonner";

export type WmsReportKey = "movements" | "aging" | "donor" | "loss" | "kits";

type ReportMeta = { key: WmsReportKey; title: string; subtitle: string; path: string; icon: LucideIcon };

/** One page per report; titles match the sidebar labels exactly. */
export const WMS_REPORTS: ReportMeta[] = [
  {
    key: "movements",
    title: "WMS stock movements",
    subtitle: "Every stock movement in and out of each warehouse, with running balances.",
    path: appPath("/reports/wms/stock-movements"),
    icon: ArrowLeftRight,
  },
  {
    key: "aging",
    title: "WMS CTN aging",
    subtitle: "CTN balances by days until expiry.",
    path: appPath("/reports/wms/ctn-aging"),
    icon: ScanLine,
  },
  {
    key: "donor",
    title: "WMS donor contribution",
    subtitle: "Units received and distributed per donor, with donor accountability statements.",
    path: appPath("/reports/wms/donor-contribution"),
    icon: HandHeart,
  },
  {
    key: "loss",
    title: "WMS loss and damage",
    subtitle: "Stock written off as lost or damaged, with the reason and source document.",
    path: appPath("/reports/wms/loss-damage"),
    icon: ShieldAlert,
  },
  {
    key: "kits",
    title: "WMS kit assembly",
    subtitle: "Audit trail of kits assembled, with contributing CTNs and donors.",
    path: appPath("/reports/wms/kit-assembly"),
    icon: Boxes,
  },
];

const OTHER_WMS_REPORTS: Array<Omit<ReportMeta, "key">> = [
  {
    title: "Monthly warehouse report",
    subtitle: "Monthly stock position per warehouse, ready to print.",
    path: appPath("/reports/wms/monthly-warehouse-report"),
    icon: FileBarChart,
  },
  {
    title: "WMS expiry",
    subtitle: "Stock nearing expiry across warehouses.",
    path: appPath("/reports/wms/expiry"),
    icon: CalendarClock,
  },
];

const NUM = "text-right tabular-nums";
const WIDE = "min-w-[12rem] whitespace-normal";

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

/** Legacy tab names (old deep links) map onto the single report pages. */
type Props = { report?: WmsReportKey; initialTab?: WmsReportKey; params?: unknown };

export default function WmsReportSuite(props: Props) {
  const report = props.report ?? props.initialTab;
  if (!report) return <WmsReportOverview />;
  return <WmsSingleReport report={report} />;
}

function WmsReportOverview() {
  return (
    <div className="space-y-4">
      <PageHeader
        icon={Warehouse}
        title="WMS report suite"
        subtitle="Stock movements, CTN aging, donor contribution, loss and damage, and kit assembly audit."
      />
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]" data-testid="wms-report-overview">
        {[...WMS_REPORTS, ...OTHER_WMS_REPORTS].map((r) => (
          <Link key={r.path} href={r.path} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <r.icon className="h-4 w-4 text-primary dark:text-[#F87171]" aria-hidden />
                  {r.title}
                </CardTitle>
                <CardDescription>{r.subtitle}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby="wms-date-hint" />
    </div>
  );
}

function WmsSingleReport({ report }: { report: WmsReportKey }) {
  const meta = WMS_REPORTS.find((r) => r.key === report) ?? WMS_REPORTS[0];
  const { isMobile, showAllColumns, showAll, setShowAll } = useMobileTableColumns();
  const sec = cn(mobileSecondaryCol(showAllColumns));
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

  const sitesQuery = trpc.sites.list.useQuery(undefined, { enabled: report === "movements" });
  const movementsQuery = trpc.inventoryV2.reports.wmsStockMovements.useQuery(
    {
      warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      search: search || undefined,
      sourceType: sourceType === "all" ? undefined : sourceType,
      direction,
    },
    { enabled: report === "movements" }
  );
  const ctnAgingQuery = trpc.inventoryV2.reports.ctnAging.useQuery(undefined, { enabled: report === "aging" });
  const donorQuery = trpc.inventoryV2.reports.donorContribution.useQuery(
    { startDate: startDate || undefined, endDate: endDate || undefined },
    { enabled: report === "donor" }
  );
  const donorsQuery = trpc.wms.ctn.donors.useQuery(undefined, { enabled: report === "donor" });
  const donorStatementQuery = trpc.inventoryV2.reports.donorStatement.useQuery(
    {
      donorId: Number(donorId),
      from: statementFrom || undefined,
      to: statementTo || undefined,
    },
    { enabled: report === "donor" && !!donorId }
  );
  const donorStatementPdf = trpc.inventoryV2.reports.donorStatementPdf.useMutation({
    onSuccess: (r) => {
      downloadBase64File(r.data, r.filename, r.mimeType);
      toast.success("Donor statement PDF downloaded");
    },
    onError: (e) => toast.error(e.message),
  });
  const lossQuery = trpc.inventoryV2.reports.lossDamage.useQuery(
    { startDate: startDate || undefined, endDate: endDate || undefined },
    { enabled: report === "loss" }
  );
  const kitQuery = trpc.inventoryV2.reports.kitAssemblyAudit.useQuery(undefined, { enabled: report === "kits" });

  const warehouses = useMemo(() => (sitesQuery.data ?? []).filter((s) => s.facilityType === "warehouse"), [sitesQuery.data]);

  const showDateFilters = report === "movements" || report === "donor" || report === "loss";

  const exportMenu = (filename: string, columns: string[], rows: Array<Record<string, unknown>>) => (
    <ExportMenu
      formats={[
        { id: "csv", label: "Export CSV", onSelect: () => exportCsv(`${filename}.csv`, columns, rows) },
        {
          id: "excel",
          label: "Export to Excel",
          disabled: exportReportMutation.isPending,
          onSelect: () => {
            void downloadExcel(`${filename}.xlsx`, rows);
          },
        },
      ]}
    />
  );

  const movementRows = movementsQuery.data ?? [];
  const agingRows = ctnAgingQuery.data ?? [];
  const donorRows = donorQuery.data ?? [];
  const lossRows = lossQuery.data ?? [];
  const kitRows = kitQuery.data ?? [];

  const actions =
    report === "movements"
      ? exportMenu(
          "wms-stock-movements",
          ["date", "documentRef", "item", "ctn", "donor", "warehouse", "fromTo", "qtyIn", "qtyOut", "balanceAfter", "sourceType"],
          movementRows as any
        )
      : report === "aging"
        ? exportMenu(
            "wms-ctn-aging",
            ["ctnCode", "item", "donor", "warehouse", "balance", "expiryDate", "daysUntilExpiry", "color"],
            agingRows as any
          )
        : report === "donor"
          ? exportMenu("wms-donor-contribution", ["donor", "item", "received", "distributed", "inStock", "percentDistributed"], donorRows as any)
          : report === "loss"
            ? exportMenu(
                "wms-loss-damage",
                ["date", "item", "ctn", "donor", "warehouse", "qty", "sourceType", "documentRef", "reason"],
                lossRows as any
              )
            : exportMenu(
                "wms-kit-assembly",
                ["date", "kitItem", "kitCtn", "qtyAssembled", "contributingCtnAndDonor", "assemblerName"],
                kitRows as any
              );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={meta.icon}
        title={meta.title}
        subtitle={meta.subtitle}
        back={{ label: "WMS report suite", href: appPath("/reports/wms") }}
        actions={actions}
      />

      {report === "movements" || showDateFilters ? (
        <div className="rounded-md border p-4" data-testid="wms-filters">
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
            {report === "movements" ? (
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
            ) : null}
            <DateField label="Start date" value={startDate} onChange={setStartDate} />
            <DateField label="End date" value={endDate} onChange={setEndDate} />
            {report === "movements" ? (
              <>
                <div className="space-y-1"><Label>Search</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                <div className="space-y-1"><Label>Source</Label><Input value={sourceType === "all" ? "" : sourceType} placeholder="All" onChange={(e) => setSourceType(e.target.value || "all")} /></div>
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
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <p id="wms-date-hint" className="text-xs text-muted-foreground">Dates use {DATE_INPUT_HINT}.</p>
            <MobileColumnsToggle isMobile={isMobile} showAll={showAll} onToggle={setShowAll} />
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <MobileColumnsToggle isMobile={isMobile} showAll={showAll} onToggle={setShowAll} />
        </div>
      )}

      {report === "movements" ? (
        <div className="frozen-table-wrap sticky-first-col rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className={sec}>Document ref</TableHead><TableHead className={WIDE}>Item</TableHead><TableHead className={sec}>CTN</TableHead><TableHead className={sec}>Donor</TableHead><TableHead className={cn(sec, WIDE)}>From/To</TableHead><TableHead className={cn(sec, NUM)}>Qty in</TableHead><TableHead className={cn(sec, NUM)}>Qty out</TableHead><TableHead className={NUM}>Balance</TableHead><TableHead className={sec}>Source</TableHead></TableRow></TableHeader>
            <TableBody>
              {movementRows.map((row, idx) => <TableRow key={idx}><TableCell>{formatDate(row.date) || row.date}</TableCell><TableCell className={sec}>{row.documentRef ?? ""}</TableCell><TableCell className={WIDE}>{row.item}</TableCell><TableCell className={sec}>{row.ctn}</TableCell><TableCell className={sec}>{row.donor}</TableCell><TableCell className={cn(sec, WIDE)}>{row.fromTo ?? ""}</TableCell><TableCell className={cn(sec, NUM)}>{row.qtyIn}</TableCell><TableCell className={cn(sec, NUM)}>{row.qtyOut}</TableCell><TableCell className={NUM}>{row.balanceAfter}</TableCell><TableCell className={sec}>{formatEnumLabel(row.sourceType)}</TableCell></TableRow>)}
              {!movementsQuery.isLoading && movementRows.length === 0 ? (
                <TableEmptyState colSpan={10} icon={ArrowLeftRight} title="No stock movements yet" body="Stock movements appear here once a GRN, waybill or transfer is posted." />
              ) : null}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {report === "aging" ? (
        <div className="frozen-table-wrap sticky-first-col rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>CTN code</TableHead><TableHead className={WIDE}>Item</TableHead><TableHead className={sec}>Donor</TableHead><TableHead className={cn(sec, WIDE)}>Warehouse</TableHead><TableHead className={NUM}>Balance</TableHead><TableHead className={sec}>Expiry</TableHead><TableHead className={cn(sec, NUM)}>Days</TableHead></TableRow></TableHeader>
            <TableBody>
              {agingRows.map((row, idx) => <TableRow key={idx}><TableCell>{row.ctnCode}</TableCell><TableCell className={WIDE}>{row.item}</TableCell><TableCell className={sec}>{row.donor}</TableCell><TableCell className={cn(sec, WIDE)}>{row.warehouse}</TableCell><TableCell className={NUM}>{row.balance}</TableCell><TableCell className={sec}>{formatDate(row.expiryDate)}</TableCell><TableCell className={cn(row.color === "red" ? "text-red-600" : row.color === "amber" ? "text-amber-600" : "text-green-600", sec, NUM)}>{row.daysUntilExpiry ?? ""}</TableCell></TableRow>)}
              {!ctnAgingQuery.isLoading && agingRows.length === 0 ? (
                <TableEmptyState colSpan={7} icon={ScanLine} title="No CTNs yet" body="CTNs appear here once stock is received with a CTN code." />
              ) : null}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {report === "donor" ? (
        <div className="space-y-4">
          <div className="rounded-md border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Donor accountability statement</h3>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
              <div className="space-y-1">
                <Label>Donor</Label>
                <Select value={donorId || "none"} onValueChange={(v) => setDonorId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select donor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select donor</SelectItem>
                    {(donorsQuery.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name} ({d.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DateField label="From" value={statementFrom} onChange={setStatementFrom} />
              <DateField label="To" value={statementTo} onChange={setStatementTo} />
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
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Ledger discrepancies: {donorStatementQuery.data.discrepancies.join("; ") || "Review line balances."}
              </p>
            ) : null}
            {donorId && donorStatementQuery.data ? (
              <div className="frozen-table-wrap sticky-first-col rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={WIDE}>Item</TableHead>
                      <TableHead className={NUM}>Opening</TableHead>
                      <TableHead className={cn(sec, NUM)}>Received</TableHead>
                      <TableHead className={cn(sec, NUM)}>Distributed</TableHead>
                      <TableHead className={cn(sec, NUM)}>Losses</TableHead>
                      <TableHead className={NUM}>Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donorStatementQuery.data.lines.map((line) => (
                      <TableRow key={line.catalogueId}>
                        <TableCell className={WIDE}>{line.itemName} ({line.itemCode})</TableCell>
                        <TableCell className={NUM}>{line.openingBalance}</TableCell>
                        <TableCell className={cn(sec, NUM)}>{line.received}</TableCell>
                        <TableCell className={cn(sec, NUM)}>{line.distributed}</TableCell>
                        <TableCell className={cn(sec, NUM)}>{line.losses}</TableCell>
                        <TableCell className={NUM}>{line.closingBalance}</TableCell>
                      </TableRow>
                    ))}
                    {donorStatementQuery.data.lines.length === 0 ? (
                      <TableEmptyState colSpan={6} icon={HandHeart} title="No statement lines yet" body="Statement lines appear here once this donor's stock is received." />
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
          <div className="frozen-table-wrap sticky-first-col rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead className={WIDE}>Donor</TableHead><TableHead className={WIDE}>Item</TableHead><TableHead className={cn(sec, NUM)}>Total units received</TableHead><TableHead className={cn(sec, NUM)}>Total distributed</TableHead><TableHead className={NUM}>In stock</TableHead><TableHead className={cn(sec, NUM)}>% distributed</TableHead></TableRow></TableHeader>
              <TableBody>
                {donorRows.map((row, idx) => <TableRow key={idx}><TableCell className={WIDE}>{row.donor}</TableCell><TableCell className={WIDE}>{row.item}</TableCell><TableCell className={cn(sec, NUM)}>{row.received}</TableCell><TableCell className={cn(sec, NUM)}>{row.distributed}</TableCell><TableCell className={NUM}>{row.inStock}</TableCell><TableCell className={cn(sec, NUM)}>{row.percentDistributed.toFixed(2)}%</TableCell></TableRow>)}
                {!donorQuery.isLoading && donorRows.length === 0 ? (
                  <TableEmptyState colSpan={6} icon={HandHeart} title="No donor contributions yet" body="Donor contributions appear here once donor stock is received." />
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {report === "loss" ? (
        <div className="frozen-table-wrap sticky-first-col rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className={WIDE}>Item</TableHead><TableHead className={sec}>CTN</TableHead><TableHead className={sec}>Donor</TableHead><TableHead className={cn(sec, WIDE)}>Warehouse</TableHead><TableHead className={NUM}>Qty</TableHead><TableHead className={sec}>Source</TableHead><TableHead className={sec}>Document ref</TableHead><TableHead className={sec}>Reason</TableHead></TableRow></TableHeader>
            <TableBody>
              {lossRows.map((row, idx) => <TableRow key={idx}><TableCell>{formatDate(row.date) || row.date}</TableCell><TableCell className={WIDE}>{row.item}</TableCell><TableCell className={sec}>{row.ctn}</TableCell><TableCell className={sec}>{row.donor}</TableCell><TableCell className={cn(sec, WIDE)}>{row.warehouse}</TableCell><TableCell className={NUM}>{row.qty}</TableCell><TableCell className={sec}>{formatEnumLabel(row.sourceType)}</TableCell><TableCell className={sec}>{row.documentRef ?? ""}</TableCell><TableCell className={cn(sec, "max-w-[16rem] truncate")} title={row.reason ?? undefined}>{row.reason ?? ""}</TableCell></TableRow>)}
              {!lossQuery.isLoading && lossRows.length === 0 ? (
                <TableEmptyState colSpan={9} icon={ShieldAlert} title="No losses recorded yet" body="Losses appear here once stock is written off as lost or damaged." />
              ) : null}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {report === "kits" ? (
        <div className="frozen-table-wrap sticky-first-col rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className={WIDE}>Kit item</TableHead><TableHead className={sec}>Kit CTN</TableHead><TableHead className={NUM}>Qty assembled</TableHead><TableHead className={cn(sec, WIDE)}>Contributing CTNs and donors</TableHead><TableHead className={sec}>Assembler</TableHead></TableRow></TableHeader>
            <TableBody>
              {kitRows.map((row, idx) => <TableRow key={idx}><TableCell>{formatDate(row.date) || row.date}</TableCell><TableCell className={WIDE}>{row.kitItem}</TableCell><TableCell className={sec}>{row.kitCtn}</TableCell><TableCell className={NUM}>{row.qtyAssembled}</TableCell><TableCell className={cn(sec, WIDE)}>{row.contributingCtnAndDonor}</TableCell><TableCell className={sec}>{row.assemblerName ?? ""}</TableCell></TableRow>)}
              {!kitQuery.isLoading && kitRows.length === 0 ? (
                <TableEmptyState colSpan={6} icon={Boxes} title="No kits assembled yet" body="Kits appear here once a kit is assembled from CTN stock." />
              ) : null}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
