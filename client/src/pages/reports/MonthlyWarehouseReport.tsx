import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { downloadBase64File } from "@/lib/download";
import PageHeader from "@/components/ui/PageHeader";
import { CalendarDays, Loader2 } from "lucide-react";

export default function MonthlyWarehouseReport() {
  const [, setLocation] = useLocation();
  const now = new Date();
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const warehousesQuery = trpc.sites.list.useQuery();
  const canQuery = warehouseId.length > 0;
  const reportQuery = trpc.inventoryV2.reports.monthlyWarehouseReport.useQuery(
    { warehouseId: Number(warehouseId), month: Number(month), year: Number(year) },
    { enabled: canQuery }
  );

  const pdfMutation = trpc.inventoryV2.reports.monthlyWarehouseReportPdf.useMutation();
  const excelMutation = trpc.inventoryV2.reports.monthlyWarehouseReportExcel.useMutation();
  const emailMutation = trpc.inventoryV2.reports.monthlyWarehouseReportEmail.useMutation();

  const warehouseOptions = useMemo(
    () => (warehousesQuery.data ?? []).filter((site) => site.facilityType === "warehouse"),
    [warehousesQuery.data]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={CalendarDays}
        title="Monthly Warehouse Report"
        subtitle="NIGERIAN RED CROSS SOCIETY"
      />

      <div className="rounded-md border p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouseOptions.map((site) => (
                  <SelectItem key={site.id} value={String(site.id)}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Month</Label>
            <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Year</Label>
            <Input type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => reportQuery.refetch()} disabled={!canQuery}>
              Generate Report
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!canQuery || pdfMutation.isPending}
          onClick={async () => {
            const file = await pdfMutation.mutateAsync({ warehouseId: Number(warehouseId), month: Number(month), year: Number(year) });
            downloadBase64File(file.data, file.filename, file.mimeType);
          }}
        >
          {pdfMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting…
            </>
          ) : (
            "Export PDF"
          )}
        </Button>
        <Button
          variant="outline"
          disabled={!canQuery || excelMutation.isPending}
          onClick={async () => {
            const file = await excelMutation.mutateAsync({ warehouseId: Number(warehouseId), month: Number(month), year: Number(year) });
            downloadBase64File(file.data, file.filename, file.mimeType);
          }}
        >
          {excelMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting…
            </>
          ) : (
            "Export Excel"
          )}
        </Button>
        <Button
          variant="outline"
          disabled={!canQuery || emailMutation.isPending}
          onClick={async () => {
            await emailMutation.mutateAsync({
              warehouseId: Number(warehouseId),
              month: Number(month),
              year: Number(year),
              recipients: ["facility-admin@nrcs.local", "nhq-logistics@nrcs.local"],
            });
          }}
        >
          {emailMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            "Resend"
          )}
        </Button>
        <Button
          variant="outline"
          disabled={!canQuery}
          onClick={() =>
            setLocation(
              `/app/reports/wms/monthly-warehouse-report/print/${Number(warehouseId)}/${Number(year)}/${Number(month)}`
            )
          }
        >
          Print view
        </Button>
      </div>

      <div className="frozen-table-wrap rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SN</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Unit & weight</TableHead>
              <TableHead>Opening Balance (a)</TableHead>
              <TableHead>IN (b)</TableHead>
              <TableHead>OUT TO: Distributions (c)</TableHead>
              <TableHead>OUT TO: Branches store (d)</TableHead>
              <TableHead>OUT TO: Others (e)</TableHead>
              <TableHead>Loss/Damaged (f)</TableHead>
              <TableHead>Closing Balance</TableHead>
              <TableHead>Comments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(reportQuery.data ?? []).map((row) => (
              <TableRow key={row.sn}>
                <TableCell>{row.sn}</TableCell>
                <TableCell>{row.product}</TableCell>
                <TableCell>{row.unitAndWeight}</TableCell>
                <TableCell>{row.openingBalance}</TableCell>
                <TableCell>{row.inbound}</TableCell>
                <TableCell>{row.outDistributions}</TableCell>
                <TableCell>{row.outBranches}</TableCell>
                <TableCell>{row.outOthers}</TableCell>
                <TableCell>{row.lossAndDamaged}</TableCell>
                <TableCell>{row.closingBalance}</TableCell>
                <TableCell>{row.comments}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

