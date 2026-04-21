import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Food",
  "Shelter",
  "WASH",
  "Health",
  "NFI",
  "PPE",
  "Emergency Response Equipment",
  "Kits",
] as const;
const VED = ["vital", "essential", "desirable"] as const;
const STATUS_OPTIONS = ["normal", "low", "critical", "out_of_stock"] as const;

type StockOverviewRow = inferRouterOutputs<AppRouter>["inventoryV2"]["stock"]["overview"][number];
type CatalogueRow = inferRouterOutputs<AppRouter>["inventoryV2"]["catalogue"]["list"][number];

function statusLabel(status: StockOverviewRow["status"]): string {
  if (status === "out_of_stock") return "Out of Stock";
  if (status === "critical") return "Critical";
  if (status === "low") return "Low";
  return "Normal";
}

function statusClass(status: StockOverviewRow["status"]): string {
  if (status === "out_of_stock") return "bg-red-600/15 text-red-800 border-red-300 dark:text-red-200";
  if (status === "critical") return "bg-orange-600/15 text-orange-800 border-orange-300 dark:text-orange-200";
  if (status === "low") return "bg-yellow-500/20 text-yellow-800 border-yellow-300 dark:text-yellow-200";
  return "bg-green-600/15 text-green-800 border-green-300 dark:text-green-200";
}

function vedClass(value: string | null): string {
  if (value === "vital") return "bg-red-600/15 text-red-800 border-red-300 dark:text-red-200";
  if (value === "essential") return "bg-orange-600/15 text-orange-800 border-orange-300 dark:text-orange-200";
  return "bg-blue-600/15 text-blue-800 border-blue-300 dark:text-blue-200";
}

function maxRef(row: StockOverviewRow): number {
  if ((row.maxLevel ?? 0) > 0) return row.maxLevel!;
  if ((row.minLevel ?? 0) > 0) return Math.max(row.minLevel * 2, row.quantityOnHand);
  return Math.max(1, row.quantityOnHand);
}

export default function Inventory() {
  const { isAdmin, isManagerOrAdmin, isStaffOrAbove } = usePermissions();
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [ved, setVed] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [catalogueCategory, setCatalogueCategory] = useState<string>("all");
  const [catalogueVed, setCatalogueVed] = useState<string>("all");
  const [catalogueActive, setCatalogueActive] = useState<string>("all");
  const [selectedStock, setSelectedStock] = useState<StockOverviewRow | null>(null);
  const [selectedCatalogue, setSelectedCatalogue] = useState<CatalogueRow | null>(null);
  const [zoneInput, setZoneInput] = useState("");
  const [minInput, setMinInput] = useState("0");
  const [maxInput, setMaxInput] = useState("");
  const [safetyInput, setSafetyInput] = useState("");

  const overviewFilters = useMemo(
    () => ({
      warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
      category: category === "all" ? undefined : (category as (typeof CATEGORIES)[number]),
      status: status === "all" ? undefined : (status as (typeof STATUS_OPTIONS)[number]),
      ved: ved === "all" ? undefined : (ved as (typeof VED)[number]),
      search: search.trim() || undefined,
    }),
    [warehouseId, category, status, ved, search]
  );

  const { data: sites } = trpc.sites.list.useQuery();
  const warehouses = (sites ?? []).filter((s) => s.facilityType === "warehouse");
  const overviewQuery = trpc.inventoryV2.stock.overview.useQuery(overviewFilters);
  const catalogueQuery = trpc.inventoryV2.catalogue.list.useQuery({
    category: catalogueCategory === "all" ? undefined : (catalogueCategory as (typeof CATEGORIES)[number]),
    ved: catalogueVed === "all" ? undefined : (catalogueVed as (typeof VED)[number]),
    active:
      catalogueActive === "all"
        ? undefined
        : catalogueActive === "active"
          ? true
          : false,
    search: catalogueSearch.trim() || undefined,
  });
  const selectedItemDetail = trpc.inventoryV2.catalogue.get.useQuery(
    { id: selectedStock?.catalogueId ?? selectedCatalogue?.id ?? 0 },
    { enabled: !!selectedStock || !!selectedCatalogue }
  );
  const selectedStockByItem = trpc.inventoryV2.stock.byItem.useQuery(
    { catalogueId: selectedStock?.catalogueId ?? selectedCatalogue?.id ?? 0 },
    { enabled: !!selectedStock || !!selectedCatalogue }
  );

  const importMutation = trpc.inventoryV2.catalogue.import.useMutation({
    onSuccess: (res) => {
      toast.success(`Catalogue import complete. ${res.imported} seeded items available.`);
      void catalogueQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateLevels = trpc.inventoryV2.stock.updateLevels.useMutation({
    onSuccess: () => {
      toast.success("Stock levels updated.");
      void overviewQuery.refetch();
      void selectedStockByItem.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const setZoneLocation = trpc.inventoryV2.stock.setZoneLocation.useMutation({
    onSuccess: () => {
      toast.success("Zone location updated.");
      void overviewQuery.refetch();
      void selectedStockByItem.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = overviewQuery.data ?? [];
  const catalogueRows = catalogueQuery.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Inventory</h1>
        <p className="mt-1 text-muted-foreground">
          Humanitarian stock management for relief materials across warehouses.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="inventory-tab-overview">
            Stock Overview
          </TabsTrigger>
          <TabsTrigger value="catalogue" data-testid="inventory-tab-catalogue">
            Item Catalogue
          </TabsTrigger>
          {isManagerOrAdmin ? (
            <TabsTrigger value="settings" data-testid="inventory-tab-settings">
              Settings
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="Warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ved} onValueChange={setVed}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All VED</SelectItem>
                <SelectItem value="vital">Vital</SelectItem>
                <SelectItem value="essential">Essential</SelectItem>
                <SelectItem value="desirable">Desirable</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-9 min-w-[220px]"
              placeholder="Search item code/name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="ml-auto flex items-center gap-1 rounded-md border p-1">
              <Button
                size="sm"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                onClick={() => setViewMode("grid")}
              >
                Grid
              </Button>
              <Button
                size="sm"
                variant={viewMode === "table" ? "secondary" : "ghost"}
                onClick={() => setViewMode("table")}
              >
                Table
              </Button>
            </div>
          </div>

          {viewMode === "grid" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => {
                const progress = Math.min(100, Math.round((row.quantityOnHand / maxRef(row)) * 100));
                return (
                  <Card
                    key={`${row.catalogueId}-${row.warehouseId}`}
                    data-testid={`stock-card-${row.itemCode}`}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedStock(row);
                      setZoneInput(row.zoneLocation ?? "");
                      setMinInput(String(row.minLevel ?? 0));
                      setMaxInput(row.maxLevel == null ? "" : String(row.maxLevel));
                      setSafetyInput(row.safetyStockLevel == null ? "" : String(row.safetyStockLevel));
                    }}
                  >
                    <CardContent className="pt-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Package className="h-5 w-5 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{row.itemName}</p>
                            <p className="text-xs text-muted-foreground">{row.itemCode}</p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("border", vedClass(row.vedClassification))}
                          data-testid="ved-badge"
                          data-ved={row.vedClassification ?? "desirable"}
                        >
                          {(row.vedClassification ?? "desirable").toUpperCase().charAt(0)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{row.warehouseName}</p>
                      <div className="mt-2 text-sm">
                        <span className="font-semibold">{row.quantityOnHand}</span> {row.unitOfMeasure}
                      </div>
                      <div className="mt-2 h-2 w-full rounded bg-muted">
                        <div className="h-2 rounded bg-primary" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn("border", statusClass(row.status))}
                          data-testid="stock-status-badge"
                          data-status={row.status === "out_of_stock" ? "out" : row.status}
                        >
                          {statusLabel(row.status)}
                        </Badge>
                        <Badge variant="secondary">{row.category}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border px-2 md:px-3">
              <table className="min-w-[1300px] text-sm">
                <thead className="sticky top-0 z-40 bg-background">
                  <tr className="border-b">
                    <th className="sticky left-0 z-[45] border-r bg-background px-2 py-2 text-left">Item Code</th>
                    <th className="sticky left-[120px] z-[45] border-r bg-background px-2 py-2 text-left">Item Name</th>
                    <th className="sticky left-[360px] z-[45] border-r bg-background px-2 py-2 text-left shadow-[4px_0_8px_-4px_rgba(0,0,0,0.25)]">Warehouse</th>
                    <th className="px-2 py-2 text-left">Category</th>
                    <th className="px-2 py-2 text-right">On Hand</th>
                    <th className="px-2 py-2 text-left">Unit</th>
                    <th className="px-2 py-2 text-right">Min</th>
                    <th className="px-2 py-2 text-right">Max</th>
                    <th className="px-2 py-2 text-right">Safety</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">VED</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`${row.catalogueId}-${row.warehouseId}`}
                      className="relative z-10 cursor-pointer border-b hover:bg-muted/50"
                      onClick={() => {
                        setSelectedStock(row);
                        setZoneInput(row.zoneLocation ?? "");
                        setMinInput(String(row.minLevel ?? 0));
                        setMaxInput(row.maxLevel == null ? "" : String(row.maxLevel));
                        setSafetyInput(row.safetyStockLevel == null ? "" : String(row.safetyStockLevel));
                      }}
                    >
                      <td className="sticky left-0 z-[35] border-r bg-background px-2 py-2 font-mono">
                        {row.itemCode}
                      </td>
                      <td className="sticky left-[120px] z-[35] w-[240px] min-w-[240px] max-w-[240px] truncate border-r bg-background px-2 py-2">
                        {row.itemName}
                      </td>
                      <td className="sticky left-[360px] z-[35] border-r bg-background px-2 py-2 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.25)]">
                        {row.warehouseName}
                      </td>
                      <td className="px-2 py-2">{row.category}</td>
                      <td className="px-2 py-2 text-right">{row.quantityOnHand}</td>
                      <td className="px-2 py-2">{row.unitOfMeasure}</td>
                      <td className="px-2 py-2 text-right">{row.minLevel}</td>
                      <td className="px-2 py-2 text-right">{row.maxLevel ?? "—"}</td>
                      <td className="px-2 py-2 text-right">{row.safetyStockLevel ?? "—"}</td>
                      <td className="px-2 py-2">
                        <Badge
                          variant="outline"
                          className={cn("border", statusClass(row.status))}
                          data-testid="stock-status-badge"
                          data-status={row.status === "out_of_stock" ? "out" : row.status}
                        >
                          {statusLabel(row.status)}
                        </Badge>
                      </td>
                      <td className="px-2 py-2">
                        <Badge
                          variant="outline"
                          className={cn("border", vedClass(row.vedClassification))}
                          data-testid="ved-badge"
                          data-ved={row.vedClassification ?? "desirable"}
                        >
                          {row.vedClassification ?? "desirable"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalogue" className="space-y-4">
          <div className="rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              {isManagerOrAdmin ? (
                <Button className="h-9" disabled>
                  Add Item
                </Button>
              ) : null}
              {isManagerOrAdmin ? (
                <Button
                  className="h-9"
                  variant="outline"
                  onClick={() => importMutation.mutate({})}
                  disabled={importMutation.isPending}
                >
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  Import from IFRC Catalogue
                </Button>
              ) : null}
              {isManagerOrAdmin ? (
                <Button className="h-9" variant="outline" disabled>
                  <ArrowUpFromLine className="mr-2 h-4 w-4" />
                  Export Catalogue
                </Button>
              ) : null}
              <Input
                className="ml-auto h-9 min-w-[240px]"
                placeholder="Search code/name"
                value={catalogueSearch}
                onChange={(e) => setCatalogueSearch(e.target.value)}
              />
              <Select value={catalogueCategory} onValueChange={setCatalogueCategory}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={catalogueVed} onValueChange={setCatalogueVed}>
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All VED</SelectItem>
                  <SelectItem value="vital">Vital</SelectItem>
                  <SelectItem value="essential">Essential</SelectItem>
                  <SelectItem value="desirable">Desirable</SelectItem>
                </SelectContent>
              </Select>
              <Select value={catalogueActive} onValueChange={setCatalogueActive}>
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left">Code</th>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Category</th>
                  <th className="px-2 py-2 text-left">Subcategory</th>
                  <th className="px-2 py-2 text-left">Unit</th>
                  <th className="px-2 py-2 text-left">VED</th>
                  <th className="px-2 py-2 text-left">Has Expiry</th>
                  <th className="px-2 py-2 text-left">Cold Chain</th>
                  <th className="px-2 py-2 text-left">Active</th>
                </tr>
              </thead>
              <tbody>
                {catalogueRows.map((row) => (
                  <tr
                    key={row.id}
                    data-testid={`catalogue-row-${row.itemCode}`}
                    className="cursor-pointer border-b hover:bg-muted/40"
                    onClick={() => setSelectedCatalogue(row)}
                  >
                    <td className="px-2 py-2 font-mono">{row.itemCode}</td>
                    <td className="px-2 py-2">{row.name}</td>
                    <td className="px-2 py-2">{row.category}</td>
                    <td className="px-2 py-2">{row.subcategory ?? "—"}</td>
                    <td className="px-2 py-2">{row.unitOfMeasure}</td>
                    <td className="px-2 py-2">
                      <Badge
                        variant="outline"
                        className={cn("border", vedClass(row.vedClassification))}
                        data-testid="ved-badge"
                        data-ved={row.vedClassification ?? "desirable"}
                      >
                        {row.vedClassification ?? "desirable"}
                      </Badge>
                    </td>
                    <td className="px-2 py-2">{row.hasExpiry ? "Yes" : "No"}</td>
                    <td className="px-2 py-2">{row.coldChainRequired ? "Yes" : "No"}</td>
                    <td className="px-2 py-2">{row.isActive ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {isManagerOrAdmin ? (
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Categories (view only)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <Badge key={c} variant="secondary">
                      {c}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>VED Classification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">Vital</span>: lifesaving and immediate-response items.
                </p>
                <p>
                  <span className="font-semibold text-foreground">Essential</span>: core continuity items for sustained response.
                </p>
                <p>
                  <span className="font-semibold text-foreground">Desirable</span>: supporting items with lower urgency.
                </p>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => importMutation.mutate({})}>
                    Import IFRC Catalogue
                  </Button>
                  <Button variant="outline" disabled>
                    Export Catalogue
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!isAdmin}
                    onClick={() => toast.info("Reset stock levels will be enabled in a later phase.")}
                  >
                    Reset Stock Levels
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      <Dialog
        open={!!selectedStock || !!selectedCatalogue}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStock(null);
            setSelectedCatalogue(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedItemDetail.data?.name ?? selectedStock?.itemName ?? selectedCatalogue?.name}</DialogTitle>
            <DialogDescription>
              {selectedItemDetail.data?.itemCode ?? selectedStock?.itemCode ?? selectedCatalogue?.itemCode}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Item Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="font-semibold">Category:</span> {selectedItemDetail.data?.category ?? selectedStock?.category}</p>
                <p><span className="font-semibold">VED:</span> {selectedItemDetail.data?.vedClassification ?? selectedStock?.vedClassification ?? "desirable"}</p>
                <p><span className="font-semibold">Unit:</span> {selectedItemDetail.data?.unitOfMeasure ?? selectedStock?.unitOfMeasure}</p>
                <p><span className="font-semibold">Description:</span> {selectedItemDetail.data?.description ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Movement</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Movement history integration lands in Phase 2.
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stock Across Warehouses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-2 py-2 text-left">Warehouse</th>
                      <th className="px-2 py-2 text-left">On Hand</th>
                      <th className="px-2 py-2 text-left">Min</th>
                      <th className="px-2 py-2 text-left">Max</th>
                      <th className="px-2 py-2 text-left">Safety</th>
                      <th className="px-2 py-2 text-left">Zone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedStockByItem.data ?? []).map((row) => (
                      <tr key={row.stockId} className="border-b">
                        <td className="px-2 py-2">{row.warehouseName}</td>
                        <td className="px-2 py-2">{row.quantityOnHand}</td>
                        <td className="px-2 py-2">{row.minLevel}</td>
                        <td className="px-2 py-2">{row.maxLevel ?? "—"}</td>
                        <td className="px-2 py-2">{row.safetyStockLevel ?? "—"}</td>
                        <td className="px-2 py-2">{row.zoneLocation ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {selectedStock && isStaffOrAbove ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Warehouse Update Tools</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {isManagerOrAdmin ? (
                  <div className="space-y-2 rounded-md border p-3">
                    <Label>Edit stock levels</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Input value={minInput} onChange={(e) => setMinInput(e.target.value)} placeholder="Min" />
                      <Input value={maxInput} onChange={(e) => setMaxInput(e.target.value)} placeholder="Max" />
                      <Input value={safetyInput} onChange={(e) => setSafetyInput(e.target.value)} placeholder="Safety" />
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        updateLevels.mutate({
                          catalogueId: selectedStock.catalogueId,
                          warehouseId: selectedStock.warehouseId,
                          minLevel: Number(minInput) || 0,
                          maxLevel: maxInput.trim() ? Number(maxInput) : null,
                          safetyStockLevel: safetyInput.trim() ? Number(safetyInput) : null,
                        })
                      }
                    >
                      Save Levels
                    </Button>
                  </div>
                ) : null}
                <div className="space-y-2 rounded-md border p-3">
                  <Label>Set Zone Location</Label>
                  <Input
                    value={zoneInput}
                    onChange={(e) => setZoneInput(e.target.value)}
                    placeholder="Shelf A3 / Bin 15 / Cold Room 2"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setZoneLocation.mutate({
                        catalogueId: selectedStock.catalogueId,
                        warehouseId: selectedStock.warehouseId,
                        zoneLocation: zoneInput,
                      })
                    }
                  >
                    Save Location
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedStock(null);
                setSelectedCatalogue(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
