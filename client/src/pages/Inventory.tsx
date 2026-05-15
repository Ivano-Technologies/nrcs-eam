import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
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
import { ViewToggle } from "@/components/ViewToggle";
import { CardQrCode } from "@/components/CardQrCode";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import { ModuleFiltersCard, ModuleFilterSearch } from "@/components/ModuleFiltersCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { appPath } from "@/lib/routes";
import { useBulkImportFileInput } from "@/hooks/useBulkImportFileInput";
import { ITEM_CATEGORIES, isItemCategoryValue, itemCategoryLabel } from "@/lib/inventory";
import type { ItemCategory } from "@shared/itemCategory";

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

async function parseExcelFirstSheetRows(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

type InventoryMainTab = "overview" | "catalogue" | "settings";

export default function Inventory({ embedInShell = false }: { embedInShell?: boolean } = {}) {
  const urlSearch = useSearch();
  const { isAdmin, isManagerOrAdmin, isStaffOrAbove } = usePermissions();
  const [mainTab, setMainTab] = useState<InventoryMainTab>("overview");

  useEffect(() => {
    const params = new URLSearchParams(urlSearch);
    const t = params.get("tab");
    if (t === "catalogue" || t === "settings" || t === "overview") {
      setMainTab(t as InventoryMainTab);
    } else {
      setMainTab("overview");
    }
    const st = params.get("status");
    if (st && (STATUS_OPTIONS as readonly string[]).includes(st)) {
      setStatus(st);
    }
  }, [urlSearch]);
  const [overviewViewMode, setOverviewViewMode] = useState<"table" | "card">(() => {
    if (typeof window === "undefined") return "table";
    return window.localStorage.getItem("viewMode_inventory") === "card" ? "card" : "table";
  });
  const [catalogueViewMode, setCatalogueViewMode] = useState<"table" | "card">(() => {
    if (typeof window === "undefined") return "table";
    return window.localStorage.getItem("viewMode_inventory_catalogue") === "card" ? "card" : "table";
  });
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
  const [openingRows, setOpeningRows] = useState<any[]>([]);
  const [openingPreview, setOpeningPreview] = useState<any[]>([]);
  const [movementRows, setMovementRows] = useState<any[]>([]);
  const [movementPreview, setMovementPreview] = useState<any[]>([]);

  const [, navigate] = useLocation();
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [newItemCode, setNewItemCode] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemProgramCategory, setNewItemProgramCategory] = useState<(typeof CATEGORIES)[number] | "">("");
  const [newItemTaxonomy, setNewItemTaxonomy] = useState<ItemCategory | "">("");
  const [newItemUom, setNewItemUom] = useState("");
  const [editItemTaxonomy, setEditItemTaxonomy] = useState<ItemCategory | "">("");

  const baseOverviewFilters = useMemo(
    () => ({
      warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
      category: category === "all" ? undefined : (category as (typeof CATEGORIES)[number]),
      status: status === "all" ? undefined : (status as (typeof STATUS_OPTIONS)[number]),
      ved: ved === "all" ? undefined : (ved as (typeof VED)[number]),
      search: search.trim() || undefined,
    }),
    [warehouseId, category, status, ved, search]
  );

  const itemCategoryParam = useMemo((): "all" | ItemCategory => {
    const raw = new URLSearchParams(urlSearch).get("category");
    if (!raw || !isItemCategoryValue(raw)) return "all";
    return raw;
  }, [urlSearch]);

  const overviewFiltersForTable = useMemo(
    () => ({
      ...baseOverviewFilters,
      itemCategory: itemCategoryParam === "all" ? undefined : itemCategoryParam,
    }),
    [baseOverviewFilters, itemCategoryParam]
  );

  const overviewCountQueryEnabled =
    embedInShell && mainTab === "overview" && itemCategoryParam !== "all";

  const mergeOverviewSearch = (updates: Record<string, string | undefined>) => {
    const p = new URLSearchParams(urlSearch);
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    navigate(qs ? `${appPath("/inventory/stock-overview")}?${qs}` : appPath("/inventory/stock-overview"));
  };

  const { data: sites } = trpc.sites.list.useQuery();
  const warehouses = (sites ?? []).filter((s) => s.facilityType === "warehouse");
  const overviewQuery = trpc.inventoryV2.stock.overview.useQuery(overviewFiltersForTable, {
    enabled: mainTab === "overview",
  });
  const overviewCountQuery = trpc.inventoryV2.stock.overview.useQuery(baseOverviewFilters, {
    enabled: overviewCountQueryEnabled,
  });
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

  const refetchOverview = () => {
    void overviewQuery.refetch();
    void overviewCountQuery.refetch();
  };

  const importMutation = trpc.inventoryV2.catalogue.import.useMutation({
    onSuccess: (res) => {
      toast.success(`Catalogue import complete. ${res.imported} seeded items available.`);
      void catalogueQuery.refetch();
      refetchOverview();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateLevels = trpc.inventoryV2.stock.updateLevels.useMutation({
    onSuccess: () => {
      toast.success("Stock levels updated.");
      refetchOverview();
      void selectedStockByItem.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const setZoneLocation = trpc.inventoryV2.stock.setZoneLocation.useMutation({
    onSuccess: () => {
      toast.success("Zone location updated.");
      refetchOverview();
      void selectedStockByItem.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const catalogueCreate = trpc.inventoryV2.catalogue.create.useMutation({
    onSuccess: () => {
      toast.success("Item created.");
      setCreateItemOpen(false);
      setNewItemCode("");
      setNewItemName("");
      setNewItemProgramCategory("");
      setNewItemTaxonomy("");
      setNewItemUom("");
      void catalogueQuery.refetch();
      refetchOverview();
    },
    onError: (e) => toast.error(e.message),
  });
  const catalogueUpdate = trpc.inventoryV2.catalogue.update.useMutation({
    onSuccess: () => {
      toast.success("Item updated.");
      void catalogueQuery.refetch();
      void selectedItemDetail.refetch();
      refetchOverview();
    },
    onError: (e) => toast.error(e.message),
  });
  const openingDryRun = trpc.inventoryV2.adminData.importOpeningStockDryRun.useMutation();
  const openingConfirm = trpc.inventoryV2.adminData.importOpeningStockConfirm.useMutation();
  const movementDryRun = trpc.inventoryV2.adminData.importHistoricalMovementsDryRun.useMutation();
  const movementConfirm = trpc.inventoryV2.adminData.importHistoricalMovementsConfirm.useMutation();

  const openingStockFile = useBulkImportFileInput({
    prepareFile: "none",
    accept: ".xlsx,.xls",
    run: async (file) => {
      const rawRows = await parseExcelFirstSheetRows(file);
      const mapped = rawRows.map((r) => ({
        warehouseCode: String(r.warehouseCode ?? ""),
        itemCode: String(r.itemCode ?? ""),
        quantityOnHand: Number(r.quantityOnHand ?? 0),
        minLevel: Number(r.minLevel ?? 0),
        maxLevel: r.maxLevel === "" ? null : Number(r.maxLevel),
        safetyLevel: r.safetyLevel === "" ? null : Number(r.safetyLevel),
        batchNumber: String(r.batchNumber ?? ""),
        expiryDate: String(r.expiryDate ?? ""),
      }));
      setOpeningRows(mapped);
      toast.success(`Loaded ${mapped.length} opening stock rows.`);
    },
    onError: (m) => toast.error(m),
  });

  const movementStockFile = useBulkImportFileInput({
    prepareFile: "none",
    accept: ".xlsx,.xls",
    run: async (file) => {
      const rawRows = await parseExcelFirstSheetRows(file);
      const mapped = rawRows.map((r) => ({
        date: String(r.date ?? ""),
        warehouseCode: String(r.warehouseCode ?? ""),
        itemCode: String(r.itemCode ?? ""),
        movementType: String(r.movementType ?? "adjustment"),
        quantity: Number(r.quantity ?? 0),
        documentNumber: String(r.documentNumber ?? ""),
        notes: String(r.notes ?? ""),
      }));
      setMovementRows(mapped);
      toast.success(`Loaded ${mapped.length} historical movement rows.`);
    },
    onError: (m) => toast.error(m),
  });

  const rows = overviewQuery.data ?? [];
  const rowsForChipCounts = overviewCountQueryEnabled ? (overviewCountQuery.data ?? []) : rows;
  const chipCounts = useMemo(() => {
    const by = new Map<ItemCategory, number>();
    let total = 0;
    for (const row of rowsForChipCounts) {
      total++;
      const k = (row.itemCategory ?? "other") as ItemCategory;
      by.set(k, (by.get(k) ?? 0) + 1);
    }
    return { total, by };
  }, [rowsForChipCounts]);

  useEffect(() => {
    setEditItemTaxonomy(selectedItemDetail.data?.itemCategory ?? "");
  }, [selectedItemDetail.data?.id, selectedItemDetail.data?.itemCategory]);

  const catalogueRows = catalogueQuery.data ?? [];

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("viewMode_inventory", overviewViewMode);
    }
  }, [overviewViewMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("viewMode_inventory_catalogue", catalogueViewMode);
    }
  }, [catalogueViewMode]);

  return (
    <div className="space-y-5">
      {!embedInShell ? (
        <>
          <div>
            <h1 className="text-3xl font-bold">Inventory</h1>
            <p className="mt-1 text-muted-foreground">
              Humanitarian stock management for relief materials across warehouses.
            </p>
          </div>
          <InventorySecondaryNav />
        </>
      ) : null}

      <Tabs
        value={mainTab}
        onValueChange={(v) => setMainTab(v as InventoryMainTab)}
        className="space-y-4"
      >
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
          {embedInShell ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => mergeOverviewSearch({ category: undefined })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  itemCategoryParam === "all"
                    ? "border-gray-900 bg-gray-900 text-white dark:border-gray-900 dark:bg-gray-900"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-900"
                )}
              >
                All Items · {chipCounts.total}
              </button>
              {ITEM_CATEGORIES.map((c) => {
                const active = itemCategoryParam === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => mergeOverviewSearch({ category: c.value })}
                    title={c.hint}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "border-gray-900 bg-gray-900 text-white dark:border-gray-900 dark:bg-gray-900"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-900"
                    )}
                  >
                    {c.label} · {chipCounts.by.get(c.value) ?? 0}
                  </button>
                );
              })}
            </div>
          ) : null}
          <ModuleFiltersCard
            filterRow={
              <>
                <ModuleFilterSearch
                  placeholder="Search item code/name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger className="h-9 w-[220px]">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
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
              </>
            }
            toolbarStart={<ViewToggle value={overviewViewMode} onChange={setOverviewViewMode} />}
          />

          {overviewViewMode === "card" ? (
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
                            <p className="flex min-w-0 items-center gap-1 truncate font-medium">
                              {row.itemName}
                              {row.itemCategory == null ? (
                                <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Uncategorized" />
                              ) : null}
                            </p>
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
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Location:</span> {row.warehouseName}
                      </p>
                      <div className="mt-2 text-sm">
                        <span className="font-semibold">{row.quantityOnHand}</span> {row.unitOfMeasure}
                      </div>
                      <div className="mt-2 h-2 w-full rounded bg-muted">
                        <div className="h-2 rounded bg-primary" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn("border", statusClass(row.status))}
                          data-testid="stock-status-badge"
                          data-status={row.status === "out_of_stock" ? "out" : row.status}
                        >
                          {statusLabel(row.status)}
                        </Badge>
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                          {row.itemCategory == null
                            ? "—"
                            : row.itemCategory === "other"
                              ? "Other"
                              : itemCategoryLabel(row.itemCategory)}
                        </span>
                        <Badge variant="secondary">{row.category}</Badge>
                      </div>
                      <div className="mt-3 flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <CardQrCode
                          idValue={`${row.catalogueId}-${row.warehouseId}`}
                          title={row.itemName}
                          subtitle={row.itemCode}
                          encodedValue={JSON.stringify({
                            type: "stock",
                            catalogueId: row.catalogueId,
                            warehouseId: row.warehouseId,
                            code: row.itemCode,
                          })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div
              className="frozen-table-wrap rounded-md border px-2 md:px-3"
              style={
                {
                  "--col1-width": "120px",
                  "--col2-width": "200px",
                } as Record<string, string>
              }
            >
              <table
                className="min-w-[1620px] text-sm"
              >
                <thead className="bg-background">
                  <tr className="border-b">
                    <th className="w-[120px] min-w-[120px] border-r bg-background px-2 py-2 text-left">
                      Item Code
                    </th>
                    <th className="w-[200px] min-w-[200px] border-r bg-background px-2 py-2 text-left">
                      Location
                    </th>
                    <th className="w-[240px] min-w-[240px] max-w-[240px] border-r bg-background px-2 py-2 text-left">
                      Item Name
                    </th>
                    <th className="px-2 py-2 text-left">Category</th>
                    <th className="px-2 py-2 text-left">Program</th>
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
                      <td className="w-[120px] min-w-[120px] border-r bg-background px-2 py-2">
                        {row.itemCode}
                      </td>
                      <td className="w-[200px] min-w-[200px] truncate border-r bg-background px-2 py-2">
                        {row.warehouseName}
                      </td>
                      <td className="w-[240px] min-w-[240px] max-w-[240px] truncate border-r bg-background px-2 py-2">
                        <span className="inline-flex items-center gap-1">
                          {row.itemName}
                          {row.itemCategory == null ? (
                            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Uncategorized" />
                          ) : null}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {row.itemCategory == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : row.itemCategory === "other" ? (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                            Other
                          </span>
                        ) : (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                            {itemCategoryLabel(row.itemCategory)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="secondary" className="max-w-full truncate font-normal">
                          {row.category}
                        </Badge>
                      </td>
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
          <ModuleFiltersCard
            filterRow={
              <>
                <ModuleFilterSearch
                  placeholder="Search code/name"
                  value={catalogueSearch}
                  onChange={(e) => setCatalogueSearch(e.target.value)}
                />
                <Select value={catalogueCategory} onValueChange={setCatalogueCategory}>
                  <SelectTrigger className="h-9 w-[220px]" data-testid="catalogue-category-filter">
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
              </>
            }
            toolbarStart={<ViewToggle value={catalogueViewMode} onChange={setCatalogueViewMode} />}
            toolbarEnd={
              isManagerOrAdmin ? (
                <>
                  <Button
                    className="h-9"
                    variant="outline"
                    onClick={() => importMutation.mutate({})}
                    disabled={importMutation.isPending}
                  >
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Import
                  </Button>
                  <Button className="h-9" variant="outline" disabled>
                    <ArrowUpFromLine className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                  <Button className="h-9" onClick={() => setCreateItemOpen(true)}>
                    Add Item
                  </Button>
                </>
              ) : null
            }
          />
          {catalogueViewMode === "card" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {catalogueRows.map((row) => (
                <Card
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedCatalogue(row)}
                >
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex h-20 items-center justify-center rounded-md bg-muted">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="text-xs text-muted-foreground">{row.itemCode}</div>
                    <p className="truncate font-medium" title={row.name}>{row.name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{row.category}</Badge>
                      <Badge variant="outline" className={cn("border", vedClass(row.vedClassification))}>
                        {row.vedClassification ?? "desirable"}
                      </Badge>
                      {row.hasExpiry ? <Badge variant="outline">Expiry</Badge> : null}
                      {row.coldChainRequired ? <Badge variant="outline">Cold Chain</Badge> : null}
                    </div>
                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                      <CardQrCode
                        idValue={String(row.id)}
                        title={row.name}
                        subtitle={row.itemCode}
                        encodedValue={JSON.stringify({ type: "catalogue", id: row.id, code: row.itemCode })}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
          <div
            className="frozen-table-wrap rounded-md border"
            style={
              {
                "--col1-width": "140px",
                "--col2-width": "300px",
              } as Record<string, string>
            }
          >
            <table
              className="min-w-[1100px] w-full text-sm"
            >
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
                    <td className="px-2 py-2">{row.itemCode}</td>
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
          )}
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
            <Card>
              <CardHeader>
                <CardTitle>Opening Stock Balances Import</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById(openingStockFile.inputId)?.click()}
                  >
                    Choose Excel file
                  </Button>
                  <input {...openingStockFile.inputProps} />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={!openingRows.length || openingDryRun.isPending}
                    onClick={async () => {
                      const res = await openingDryRun.mutateAsync({ rows: openingRows });
                      setOpeningPreview(res.preview);
                      toast.success(`Dry run completed. ${res.summary.ok} valid row(s).`);
                    }}
                  >
                    Dry-run
                  </Button>
                  <Button
                    disabled={!openingRows.length || !isAdmin || openingConfirm.isPending}
                    onClick={async () => {
                      const res = await openingConfirm.mutateAsync({ rows: openingRows });
                      toast.success(`Imported ${res.imported}, skipped ${res.skipped}, errors ${res.errors.length}.`);
                    }}
                  >
                    Confirm & Import
                  </Button>
                </div>
                {!!openingPreview.length && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Messages</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openingPreview.map((row) => (
                        <TableRow key={row.rowNumber} className={row.status === "ok" ? "bg-green-50" : "bg-red-50"}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell>{row.warehouseCode}</TableCell>
                          <TableCell>{row.itemCode}</TableCell>
                          <TableCell>{row.status}</TableCell>
                          <TableCell>{(row.messages ?? []).join(", ") || "OK"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Historical Movements Import</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById(movementStockFile.inputId)?.click()}
                  >
                    Choose Excel file
                  </Button>
                  <input {...movementStockFile.inputProps} />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={!movementRows.length || movementDryRun.isPending}
                    onClick={async () => {
                      const res = await movementDryRun.mutateAsync({ rows: movementRows as any });
                      setMovementPreview(res.preview);
                      toast.success(`Dry run completed. ${res.summary.ok} valid row(s).`);
                    }}
                  >
                    Dry-run
                  </Button>
                  <Button
                    disabled={!movementRows.length || !isAdmin || movementConfirm.isPending}
                    onClick={async () => {
                      const res = await movementConfirm.mutateAsync({ rows: movementRows as any });
                      toast.success(`Imported ${res.imported}, skipped ${res.skipped}, errors ${res.errors.length}.`);
                    }}
                  >
                    Confirm & Import
                  </Button>
                </div>
                {!!movementPreview.length && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movementPreview.map((row) => (
                        <TableRow key={row.rowNumber} className={row.status === "ok" ? "bg-green-50" : "bg-red-50"}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{row.warehouseCode}</TableCell>
                          <TableCell>{row.itemCode}</TableCell>
                          <TableCell>{row.movementType}</TableCell>
                          <TableCell>{row.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
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
                <p>
                  <span className="font-semibold">Program (IFRC):</span>{" "}
                  {selectedItemDetail.data?.category ?? selectedStock?.category}
                </p>
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">Item category:</span>
                  {selectedItemDetail.data?.itemCategory == null ? (
                    <>
                      <span className="text-muted-foreground">—</span>
                      <TriangleAlert className="h-4 w-4 text-amber-600" aria-label="Uncategorized" />
                    </>
                  ) : selectedItemDetail.data.itemCategory === "other" ? (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      Other
                    </span>
                  ) : (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      {itemCategoryLabel(selectedItemDetail.data.itemCategory)}
                    </span>
                  )}
                </p>
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
                      <th className="px-2 py-2 text-left">Location</th>
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

          {isManagerOrAdmin && selectedItemDetail.data?.id ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Item category (taxonomy)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Distinct from the IFRC program category above. Used for Stock Overview filters.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="edit-item-taxonomy">Category</Label>
                  <Select
                    value={editItemTaxonomy || undefined}
                    onValueChange={(v) => setEditItemTaxonomy(v as ItemCategory)}
                  >
                    <SelectTrigger id="edit-item-taxonomy" className="max-w-md">
                      <SelectValue placeholder="Not classified" />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                          {c.hint ? ` — ${c.hint}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  disabled={
                    catalogueUpdate.isPending ||
                    !editItemTaxonomy ||
                    editItemTaxonomy === (selectedItemDetail.data.itemCategory ?? "")
                  }
                  onClick={() => {
                    const id = selectedItemDetail.data!.id;
                    if (!editItemTaxonomy || editItemTaxonomy === selectedItemDetail.data!.itemCategory) return;
                    catalogueUpdate.mutate({ id, itemCategory: editItemTaxonomy });
                  }}
                >
                  Save category
                </Button>
              </CardContent>
            </Card>
          ) : null}

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

      <Dialog open={createItemOpen} onOpenChange={setCreateItemOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New catalogue item</DialogTitle>
            <DialogDescription>Add a row to the item catalogue. Stock levels can be set per warehouse afterward.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-item-code">Item code</Label>
              <Input id="new-item-code" value={newItemCode} onChange={(e) => setNewItemCode(e.target.value)} placeholder="e.g. LOC-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-item-name">Name</Label>
              <Input id="new-item-name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Item name" />
            </div>
            <div className="space-y-2">
              <Label>Program (IFRC)</Label>
              <Select
                value={newItemProgramCategory || undefined}
                onValueChange={(v) => setNewItemProgramCategory(v as (typeof CATEGORIES)[number])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select program category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Item category (required)</Label>
              <Select
                value={newItemTaxonomy || undefined}
                onValueChange={(v) => setNewItemTaxonomy(v as ItemCategory)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select taxonomy category" />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                      {c.hint ? ` — ${c.hint}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-item-uom">Unit of measure</Label>
              <Input id="new-item-uom" value={newItemUom} onChange={(e) => setNewItemUom(e.target.value)} placeholder="e.g. pcs, kg" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateItemOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                catalogueCreate.isPending ||
                !newItemCode.trim() ||
                !newItemName.trim() ||
                !newItemProgramCategory ||
                !newItemTaxonomy ||
                !newItemUom.trim()
              }
              onClick={() => {
                if (!newItemProgramCategory || !newItemTaxonomy) return;
                catalogueCreate.mutate({
                  itemCode: newItemCode.trim(),
                  name: newItemName.trim(),
                  category: newItemProgramCategory,
                  itemCategory: newItemTaxonomy,
                  unitOfMeasure: newItemUom.trim(),
                });
              }}
            >
              Create item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
