import { useEffect, useMemo, useState } from "react";
import { InventoryShellActions } from "@/components/inventory/InventoryShell";
import { HtmlTableEmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import PageHeader from "@/components/ui/PageHeader";
import { Truck as TruckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Toolbar, ToolbarSearch } from "@/components/Toolbar";
import { useMobileTableColumns, MobileColumnsToggle, mobileSecondaryCol } from "@/hooks/useMobileTableColumns";
import { cn } from "@/lib/utils";
import { useLocation, useSearch } from "wouter";

export default function Issues({ embedInShell = false }: { embedInShell?: boolean } = {}) {
  const { isMobile, showAllColumns, showAll, setShowAll } = useMobileTableColumns();
  const [, setLocation] = useLocation();
  const urlSearch = useSearch();
  const [status, setStatus] = useState<"all" | "draft" | "dispatched" | "received" | "claim_raised">("all");
  const [warehouseId, setWarehouseId] = useState("all");
  const [destinationType, setDestinationType] = useState<"all" | "beneficiary" | "branch_store" | "other">("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const qs = new URLSearchParams(urlSearch);
    const st = qs.get("status");
    if (st === "all" || st === "draft" || st === "dispatched" || st === "received" || st === "claim_raised") {
      setStatus(st);
    }
    const from = qs.get("dateFrom");
    const to = qs.get("dateTo");
    if (from) setDateFrom(from);
    if (to) setDateTo(to);
  }, [urlSearch]);

  const { data: warehouses } = trpc.sites.list.useQuery();
  const waybills = trpc.inventoryV2.waybills.list.useQuery({
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
    status: status === "all" ? undefined : status,
    destinationType: destinationType === "all" ? undefined : destinationType,
  });

  const wh = useMemo(() => (warehouses ?? []).filter((x) => x.facilityType === "warehouse"), [warehouses]);

  const statusBadge = (value: string) => {
    if (value === "dispatched") return <Badge className="bg-blue-600">dispatched</Badge>;
    if (value === "received") return <Badge className="bg-green-600">received</Badge>;
    if (value === "claim_raised") return <Badge variant="destructive">claim_raised</Badge>;
    return <Badge variant="secondary">draft</Badge>;
  };

  const newWaybillButton = (
    <Button className="h-9" data-testid="new-waybill-btn" onClick={() => setLocation("/app/inventory/issues/new")}>
      New waybill
    </Button>
  );

  return (
    <div className="space-y-6">
      <InventoryShellActions>{newWaybillButton}</InventoryShellActions>
      {!embedInShell ? (
        <>
          <PageHeader icon={TruckIcon} title="Shipping and tracking" actions={newWaybillButton} />
          <InventorySecondaryNav />
        </>
      ) : null}
      <Toolbar
        filters={
          <>
            <ToolbarSearch
              placeholder="Search WB number or destination"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <DateInput className="h-9 w-36" aria-label="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <DateInput className="h-9 w-36" aria-label="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Source warehouse" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {wh.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="claim_raised">Claim raised</SelectItem>
              </SelectContent>
            </Select>
            <Select value={destinationType} onValueChange={(v) => setDestinationType(v as typeof destinationType)}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All destinations</SelectItem>
                <SelectItem value="beneficiary">Beneficiary</SelectItem>
                <SelectItem value="branch_store">Branch store</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        end={
          <MobileColumnsToggle isMobile={isMobile} showAll={showAll} onToggle={setShowAll} />
        }
      />

      <div
        className="frozen-table-wrap sticky-first-col rounded-md border"
        style={
          {
            "--col1-width": "150px",
            "--col2-width": "140px",
          } as Record<string, string>
        }
      >
        <table
          className="min-w-[1000px] w-full text-sm"
        >
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="px-2 py-2 text-left">WB number</th>
              <th className={cn("px-2 py-2 text-left", mobileSecondaryCol(showAllColumns))}>Date</th>
              <th className={cn("px-2 py-2 text-left", mobileSecondaryCol(showAllColumns))}>Source warehouse</th>
              <th className="px-2 py-2 text-left">Destination</th>
              <th className={cn("px-2 py-2 text-left", mobileSecondaryCol(showAllColumns))}>Line count</th>
              <th className={cn("px-2 py-2 text-left", mobileSecondaryCol(showAllColumns))}>Total units</th>
              <th className="px-2 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {(waybills.data ?? []).map((row) => (
              <tr
                key={row.id}
                data-testid={`waybill-row-${row.wbNumber}`}
                className="cursor-pointer border-b hover:bg-muted/30"
                onClick={() => setLocation(`/app/inventory/issues/${row.id}`)}
              >
                <td className="px-2 py-2 font-mono">{row.wbNumber}</td>
                <td className={cn("px-2 py-2", mobileSecondaryCol(showAllColumns))}>{formatDate(row.date)}</td>
                <td className={cn("px-2 py-2", mobileSecondaryCol(showAllColumns))}>{wh.find((x) => x.id === row.warehouseId)?.name ?? row.warehouseId}</td>
                <td className="px-2 py-2">{row.destinationBeneficiary ?? ""}</td>
                <td className={cn("px-2 py-2", mobileSecondaryCol(showAllColumns))}>{row.lineCount ?? 0}</td>
                <td className={cn("px-2 py-2", mobileSecondaryCol(showAllColumns))}>{row.totalUnits ?? 0}</td>
                <td className="px-2 py-2">{statusBadge(row.status)}</td>
              </tr>
            ))}
            {!waybills.isLoading && (waybills.data ?? []).length === 0 ? (
              <HtmlTableEmptyState
                colSpan={7}
                icon={TruckIcon}
                title="No waybills yet"
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
