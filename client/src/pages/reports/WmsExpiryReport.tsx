import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMobileTableColumns, MobileColumnsToggle, mobileSecondaryCol } from "@/hooks/useMobileTableColumns";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function tone(days: number | null) {
  if (days == null) return "";
  if (days < 30) return "text-red-600";
  if (days <= 90) return "text-amber-600";
  return "text-green-600";
}

export default function WmsExpiryReport() {
  const { isMobile, showAllColumns, showAll, setShowAll } = useMobileTableColumns();
  const q = trpc.inventoryV2.reports.expiryWms.useQuery({ days: 365 });

  const exportCsv = () => {
    const rows = q.data ?? [];
    const head = "Item,CTN Code,Donor,Location,Balance,Expiry Date,Days Until Expiry\n";
    const body = rows
      .map((r) => [r.item, r.ctnCode, r.donor, r.location, r.balance, r.expiryDate ?? "", r.daysUntilExpiry ?? ""].join(","))
      .join("\n");
    const blob = new Blob([head + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wms-expiry-report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">WMS Expiry Report</h1>
        <div className="flex flex-wrap items-center gap-2">
          <MobileColumnsToggle isMobile={isMobile} showAll={showAll} onToggle={setShowAll} />
          <Button onClick={exportCsv}>Export CSV</Button>
        </div>
      </div>
      <div className="frozen-table-wrap sticky-first-col overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className={cn(mobileSecondaryCol(showAllColumns))}>CTN code</TableHead>
              <TableHead className={cn(mobileSecondaryCol(showAllColumns))}>Donor</TableHead>
              <TableHead className={cn(mobileSecondaryCol(showAllColumns))}>Location</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className={cn(mobileSecondaryCol(showAllColumns))}>Expiry date</TableHead>
              <TableHead>Days until expiry</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((row, idx) => (
              <TableRow key={`${row.ctnCode}-${idx}`}>
                <TableCell>{row.item}</TableCell>
                <TableCell className={cn("font-mono", mobileSecondaryCol(showAllColumns))}>{row.ctnCode}</TableCell>
                <TableCell className={cn(mobileSecondaryCol(showAllColumns))}>{row.donor}</TableCell>
                <TableCell className={cn(mobileSecondaryCol(showAllColumns))}>{row.location}</TableCell>
                <TableCell className="text-right">{row.balance}</TableCell>
                <TableCell className={cn(mobileSecondaryCol(showAllColumns))}>{row.expiryDate ?? "—"}</TableCell>
                <TableCell className={tone(row.daysUntilExpiry)}>{row.daysUntilExpiry ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
