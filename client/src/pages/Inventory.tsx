import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package,
  Plus,
  AlertTriangle,
  LayoutGrid,
  List,
  ClipboardList,
  History,
  FileBarChart,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/_core/hooks/usePermissions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function stockBorderClass(item: { currentStock: number; minStockLevel: number }): string {
  if (item.currentStock <= 0) return "border-2 border-red-500 shadow-red-500/10";
  if (item.currentStock < item.minStockLevel) return "border-2 border-orange-500 shadow-orange-500/10";
  return "border-2 border-green-600 shadow-green-600/10";
}

function InventoryItemQr({ itemCode }: { itemCode: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((QR) =>
        QR.default.toDataURL(`INV:${itemCode}`, { width: 120, margin: 1, errorCorrectionLevel: "M" })
      )
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [itemCode]);

  if (!src) {
    return <div className="h-[120px] w-[120px] bg-muted rounded animate-pulse" data-testid="inventory-item-qr" />;
  }
  return (
    <img
      src={src}
      alt={`QR code for ${itemCode}`}
      className="h-[120px] w-[120px] rounded border bg-white p-1"
      data-testid="inventory-item-qr"
    />
  );
}

export default function Inventory() {
  const [location] = useLocation();
  const { canAddInventory, canDeleteInventory } = usePermissions();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [overviewSite, setOverviewSite] = useState<string>("all");
  const [stockCountSite, setStockCountSite] = useState<string>("");
  const [countInputs, setCountInputs] = useState<Record<number, string>>({});
  const [movementSite, setMovementSite] = useState<string>("all");
  const [movementStart, setMovementStart] = useState<string>("");
  const [movementEnd, setMovementEnd] = useState<string>("");

  const [formData, setFormData] = useState({
    itemCode: "",
    name: "",
    description: "",
    category: "",
    siteId: "",
    currentStock: "0",
    minStockLevel: "0",
    reorderPoint: "0",
    maxStockLevel: "",
    unitOfMeasure: "",
    unitCost: "",
    supplier: "",
  });

  const utils = trpc.useUtils();
  const { data: sites } = trpc.sites.list.useQuery();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sid = new URLSearchParams(window.location.search).get("siteId");
    if (sid && !Number.isNaN(Number(sid))) {
      setOverviewSite(sid);
    }
  }, [location]);

  const overviewSiteNum = overviewSite === "all" ? undefined : parseInt(overviewSite, 10);
  const { data: items, isLoading } = trpc.inventory.list.useQuery(
    overviewSiteNum !== undefined ? { siteId: overviewSiteNum } : undefined
  );
  const { data: lowStock } = trpc.inventory.lowStock.useQuery(
    overviewSiteNum !== undefined ? { siteId: overviewSiteNum } : undefined
  );

  const stockCountSiteNum = stockCountSite ? parseInt(stockCountSite, 10) : undefined;
  const { data: stockCountItems } = trpc.inventory.list.useQuery(
    { siteId: stockCountSiteNum! },
    { enabled: !!stockCountSiteNum }
  );

  const movementQuery = useMemo(() => {
    return {
      siteId: movementSite === "all" ? undefined : parseInt(movementSite, 10),
      startDate: movementStart ? new Date(movementStart) : undefined,
      endDate: movementEnd ? new Date(movementEnd) : undefined,
    };
  }, [movementSite, movementStart, movementEnd]);

  const { data: movements, isLoading: movementsLoading } = trpc.inventory.movements.useQuery(movementQuery);

  const deleteMutation = trpc.inventory.delete.useMutation();

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success(`${name} has been deleted`);
          void utils.inventory.list.invalidate();
          void utils.inventory.lowStock.invalidate();
          void utils.inventory.movements.invalidate();
          setDeleteTarget(null);
        },
        onError: () => toast.error("Failed to delete item"),
      }
    );
  };

  const createMutation = trpc.inventory.create.useMutation({
    onSuccess: () => {
      toast.success("Inventory item created successfully");
      utils.inventory.list.invalidate();
      utils.inventory.lowStock.invalidate();
      setOpen(false);
      setFormData({
        itemCode: "",
        name: "",
        description: "",
        category: "",
        siteId: "",
        currentStock: "0",
        minStockLevel: "0",
        reorderPoint: "0",
        maxStockLevel: "",
        unitOfMeasure: "",
        unitCost: "",
        supplier: "",
      });
    },
    onError: (error) => {
      toast.error(`Failed to create item: ${error.message}`);
    },
  });

  const submitCountMutation = trpc.inventory.submitStockCount.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.adjustedLines
          ? `Stock count saved: ${data.adjustedLines} line(s) adjusted`
          : "Stock count saved — no variances"
      );
      utils.inventory.list.invalidate();
      utils.inventory.lowStock.invalidate();
      utils.inventory.movements.invalidate();
      setCountInputs({});
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.itemCode || !formData.name || !formData.siteId) {
      toast.error("Please fill in all required fields");
      return;
    }

    createMutation.mutate({
      itemCode: formData.itemCode,
      name: formData.name,
      description: formData.description || undefined,
      category: formData.category || undefined,
      siteId: parseInt(formData.siteId, 10),
      currentStock: parseInt(formData.currentStock, 10),
      minStockLevel: parseInt(formData.minStockLevel, 10),
      reorderPoint: parseInt(formData.reorderPoint, 10),
      maxStockLevel: formData.maxStockLevel ? parseInt(formData.maxStockLevel, 10) : undefined,
      unitOfMeasure: formData.unitOfMeasure || undefined,
      unitCost: formData.unitCost || undefined,
    });
  };

  const exportMovementsCsv = () => {
    if (!movements?.length) {
      toast.error("No rows to export");
      return;
    }
    const headers = [
      "Date",
      "Item",
      "Code",
      "Type",
      "Qty",
      "BalanceAfter",
      "User",
      "Notes",
    ];
    const rows = movements.map((m) => [
      new Date(m.transactionDate).toISOString(),
      m.itemName,
      m.itemCode,
      m.type,
      String(m.quantity),
      String(m.balanceAfter),
      m.performedByName || m.performedByEmail || "",
      (m.notes || "").replaceAll('"', '""'),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-movements-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const exportLowStockCsv = () => {
    if (!lowStock?.length) {
      toast.error("No low-stock items");
      return;
    }
    const headers = ["ItemCode", "Name", "CurrentStock", "MinLevel", "SiteId"];
    const rows = lowStock.map((i) => [
      i.itemCode,
      i.name,
      String(i.currentStock),
      String(i.minStockLevel),
      String(i.siteId),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `low-stock-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const runStockCountSubmit = () => {
    if (!stockCountSiteNum || !stockCountItems?.length) {
      toast.error("Select a site with items");
      return;
    }
    const lines = stockCountItems.map((it) => {
      const raw = countInputs[it.id];
      const counted = raw !== undefined && raw !== "" ? parseInt(raw, 10) : it.currentStock;
      if (Number.isNaN(counted) || counted < 0) {
        return { itemId: it.id, countedQty: it.currentStock };
      }
      return { itemId: it.id, countedQty: counted };
    });
    submitCountMutation.mutate({ siteId: stockCountSiteNum, lines });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="inventory-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground mt-2">Spare parts, stock counts, and movement history</p>
        </div>
        {canAddInventory ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="inventory-add-item">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Inventory Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="itemCode">Item Code *</Label>
                  <Input
                    id="itemCode"
                    value={formData.itemCode}
                    onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                    placeholder="e.g., INV-001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Item Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Generator Oil Filter"
                    required
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Item description..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Filters, Lubricants"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="siteId">Facility *</Label>
                  <Select value={formData.siteId} onValueChange={(value) => setFormData({ ...formData, siteId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites?.map((site) => (
                        <SelectItem key={site.id} value={site.id.toString()}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentStock">Current Stock</Label>
                  <Input
                    id="currentStock"
                    type="number"
                    min="0"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unitOfMeasure">Unit of Measure</Label>
                  <Input
                    id="unitOfMeasure"
                    value={formData.unitOfMeasure}
                    onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                    placeholder="e.g., pieces, liters, kg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minStockLevel">Min Stock Level</Label>
                  <Input
                    id="minStockLevel"
                    type="number"
                    min="0"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reorderPoint">Reorder Point</Label>
                  <Input
                    id="reorderPoint"
                    type="number"
                    min="0"
                    value={formData.reorderPoint}
                    onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxStockLevel">Max Stock Level</Label>
                  <Input
                    id="maxStockLevel"
                    type="number"
                    min="0"
                    value={formData.maxStockLevel}
                    onChange={(e) => setFormData({ ...formData, maxStockLevel: e.target.value })}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unitCost">Unit Cost (₦)</Label>
                  <Input
                    id="unitCost"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                    placeholder="e.g., 5000"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="Supplier name"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Add Item"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        ) : null}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" data-testid="inventory-tab-overview">
            Overview
          </TabsTrigger>
          <TabsTrigger value="stock-count" data-testid="inventory-tab-stock-count">
            <ClipboardList className="h-4 w-4 mr-1" />
            Stock Count
          </TabsTrigger>
          <TabsTrigger value="movements" data-testid="inventory-tab-movements">
            <History className="h-4 w-4 mr-1" />
            Movement History
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="inventory-tab-reports">
            <FileBarChart className="h-4 w-4 mr-1" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Facility</Label>
              <Select value={overviewSite} onValueChange={setOverviewSite}>
                <SelectTrigger className="w-[200px]" data-testid="inventory-overview-site">
                  <SelectValue placeholder="All facilities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All facilities</SelectItem>
                  {sites?.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex rounded-md border p-1" data-testid="inventory-view-toggle">
              <Button
                type="button"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1"
                onClick={() => setViewMode("grid")}
                aria-pressed={viewMode === "grid"}
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </Button>
              <Button
                type="button"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
              >
                <List className="h-4 w-4" />
                List
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Stock status:</span>{" "}
            <span className="text-green-700 dark:text-green-400">Green</span> = at/above minimum,{" "}
            <span className="text-orange-700 dark:text-orange-400">Orange</span> = below minimum,{" "}
            <span className="text-red-700 dark:text-red-400">Red</span> = out of stock.
          </div>

          {lowStock && lowStock.length > 0 && (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lowStock.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Current: {item.currentStock} {item.unitOfMeasure} (min {item.minStockLevel})
                        </p>
                      </div>
                      <Badge variant="destructive">Low</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="inventory-grid">
              {items?.map((item) => (
                <Card
                  key={item.id}
                  className={cn(
                    "relative overflow-hidden transition-shadow hover:shadow-md pb-12",
                    stockBorderClass(item)
                  )}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="h-5 w-5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <CardTitle className="text-lg truncate">{item.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">{item.itemCode}</p>
                        </div>
                      </div>
                      <InventoryItemQr itemCode={item.itemCode} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stock</span>
                        <span className="font-medium">
                          {item.currentStock} {item.unitOfMeasure}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Min level</span>
                        <span>{item.minStockLevel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reorder</span>
                        <span>{item.reorderPoint}</span>
                      </div>
                      {item.unitCost && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Unit Cost</span>
                          <span>₦{parseFloat(item.unitCost).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  {canDeleteInventory ? (
                    <div className="absolute bottom-3 right-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        data-testid={`inventory-item-delete-${item.id}`}
                        aria-label={`Delete ${item.name}`}
                        onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : (
            <Card data-testid="inventory-list">
              <CardContent className="p-0">
                <div className="divide-y">
                  {canDeleteInventory ? (
                    <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/40">
                      <span>Item</span>
                      <span className="text-right">Stock</span>
                      <span className="text-center">QR</span>
                      <span className="text-right w-[88px]">Actions</span>
                    </div>
                  ) : null}
                  {items?.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex flex-wrap items-center gap-4 px-4 py-3",
                        canDeleteInventory
                          ? "sm:grid sm:grid-cols-[1fr_auto_auto_auto]"
                          : "sm:flex sm:flex-wrap sm:items-center",
                        stockBorderClass(item)
                      )}
                    >
                      <div className="flex-1 min-w-[200px] sm:min-w-0">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.itemCode}</p>
                      </div>
                      <div className="text-sm sm:text-right">
                        Stock:{" "}
                        <span className="font-medium">
                          {item.currentStock} {item.unitOfMeasure}
                        </span>
                      </div>
                      <div className={cn("flex justify-center", canDeleteInventory ? "" : "sm:ml-auto")}>
                        <InventoryItemQr itemCode={item.itemCode} />
                      </div>
                      {canDeleteInventory ? (
                        <div className="flex justify-end w-full sm:w-[88px]">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            data-testid={`inventory-item-delete-${item.id}`}
                            aria-label={`Delete ${item.name}`}
                            onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="stock-count" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock count</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select a site, enter the physical count for each line (or leave unchanged), then save. Variances post as
                adjustments.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label>Facility</Label>
                  <Select value={stockCountSite} onValueChange={setStockCountSite}>
                    <SelectTrigger className="w-[240px]" data-testid="inventory-stock-count-site">
                      <SelectValue placeholder="Choose site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites?.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  onClick={runStockCountSubmit}
                  disabled={!stockCountSiteNum || submitCountMutation.isPending}
                  data-testid="inventory-stock-count-submit"
                >
                  {submitCountMutation.isPending ? "Saving…" : "Save count & apply variance"}
                </Button>
              </div>

              {stockCountItems && stockCountItems.length > 0 && (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="p-2">Item</th>
                        <th className="p-2">Expected</th>
                        <th className="p-2">Counted</th>
                        <th className="p-2">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockCountItems.map((it) => {
                        const raw = countInputs[it.id];
                        const counted =
                          raw !== undefined && raw !== "" ? parseInt(raw, 10) : it.currentStock;
                        const variance = (Number.isNaN(counted) ? it.currentStock : counted) - it.currentStock;
                        return (
                          <tr key={it.id} className="border-b last:border-0">
                            <td className="p-2">
                              <div className="font-medium">{it.name}</div>
                              <div className="text-xs text-muted-foreground">{it.itemCode}</div>
                            </td>
                            <td className="p-2">{it.currentStock}</td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                className="h-9 w-24"
                                placeholder={String(it.currentStock)}
                                value={raw ?? ""}
                                onChange={(e) =>
                                  setCountInputs((prev) => ({
                                    ...prev,
                                    [it.id]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                            <td className="p-2">
                              {variance === 0 ? "—" : variance > 0 ? `+${variance}` : variance}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-2">
              <Label>Facility</Label>
              <Select value={movementSite} onValueChange={setMovementSite}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All facilities</SelectItem>
                  {sites?.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={movementStart} onChange={(e) => setMovementStart(e.target.value)} className="w-[160px]" />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={movementEnd} onChange={(e) => setMovementEnd(e.target.value)} className="w-[160px]" />
            </div>
            <Button type="button" variant="outline" onClick={exportMovementsCsv} data-testid="inventory-movements-export">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {movementsLoading ? (
                <p className="p-6 text-muted-foreground">Loading…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="inventory-movements-table">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="p-2 whitespace-nowrap">Date</th>
                        <th className="p-2">Item</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Qty</th>
                        <th className="p-2">Balance</th>
                        <th className="p-2">By</th>
                        <th className="p-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements?.map((m) => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="p-2 whitespace-nowrap">{new Date(m.transactionDate).toLocaleString()}</td>
                          <td className="p-2">
                            {m.itemName}
                            <div className="text-xs text-muted-foreground">{m.itemCode}</div>
                          </td>
                          <td className="p-2 capitalize">{m.type.replace("_", " ")}</td>
                          <td className="p-2">{m.quantity}</td>
                          <td className="p-2">{m.balanceAfter}</td>
                          <td className="p-2">{m.performedByName || m.performedByEmail || "—"}</td>
                          <td className="p-2 max-w-[200px] truncate" title={m.notes ?? ""}>
                            {m.notes ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!movements?.length && (
                    <p className="p-6 text-muted-foreground text-center">No movements for the selected filters.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exports</CardTitle>
              <p className="text-sm text-muted-foreground">
                Download movement history or current low-stock lines as CSV from the data already loaded for your account.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={exportMovementsCsv}>
                <Download className="h-4 w-4 mr-2" />
                Export movements (CSV)
              </Button>
              <Button type="button" variant="outline" onClick={exportLowStockCsv}>
                <Download className="h-4 w-4 mr-2" />
                Export low stock (CSV)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inventory Item</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Are you sure you want to delete ${deleteTarget.name}? This action cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleConfirmDelete}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
