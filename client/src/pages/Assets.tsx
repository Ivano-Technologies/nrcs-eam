import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Download, Upload, Edit2, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { appPath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ViewToggle, type ViewMode } from "@/components/ViewToggle";
import { CardQrCode } from "@/components/CardQrCode";

const REGISTER_STATUS_FILTER = [
  { value: "all", label: "All statuses" },
  { value: "in_use", label: "In Use" },
  { value: "in_store", label: "In Store" },
  { value: "under_maintenance", label: "Under Maintenance" },
  { value: "disposed", label: "Disposed" },
  { value: "to_be_disposed", label: "To be Disposed" },
  { value: "out_of_order", label: "Out of Order" },
  { value: "beyond_repair", label: "Beyond Repair" },
] as const;

const ACQUISITION_METHODS = [
  "Purchased Through Project",
  "Purchased Through Internal Funding",
  "Donated by ICRC",
  "Donated by IFRC",
  "Donated by Other Donor",
  "By Local Organisation",
  "Other",
] as const;

const STATUS_BADGE: Record<string, string> = {
  in_use: "bg-green-100 text-green-900 border-green-200",
  in_store: "bg-blue-100 text-blue-900 border-blue-200",
  under_maintenance: "bg-orange-100 text-orange-900 border-orange-200",
  disposed: "bg-gray-200 text-gray-800 border-gray-300",
  to_be_disposed: "bg-yellow-100 text-yellow-900 border-yellow-200",
  out_of_order: "bg-red-100 text-red-900 border-red-200",
  beyond_repair: "bg-red-950 text-red-50 border-red-900",
};

const CONDITION_BADGE: Record<string, string> = {
  Good: "bg-green-100 text-green-900 border-green-200",
  Fair: "bg-yellow-100 text-yellow-900 border-yellow-200",
  Damaged: "bg-orange-100 text-orange-900 border-orange-200",
  "Beyond Repair": "bg-red-100 text-red-900 border-red-200",
};

const REGISTER_LABELS: Record<string, string> = {
  in_use: "In Use",
  in_store: "In Store",
  under_maintenance: "Under Maintenance",
  disposed: "Disposed",
  to_be_disposed: "To be Disposed",
  out_of_order: "Out of Order",
  beyond_repair: "Beyond Repair",
};

const EM_DASH = "—";

function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return EM_DASH;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return EM_DASH;
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return EM_DASH;
  const dd = String(x.getDate()).padStart(2, "0");
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const yyyy = x.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

type SortKey =
  | "itemType"
  | "categoryName"
  | "subCategory"
  | "name"
  | "assetTag"
  | "serialNumber"
  | "acquisitionCost"
  | "currentDepreciatedValue"
  | "acquisitionMethod"
  | "projectRef"
  | "yearAcquired"
  | "acquisitionCondition"
  | "registerStatus"
  | "assignedToName"
  | "department"
  | "siteName"
  | "physicalCondition"
  | "lastCheckedAt"
  | "notes"
  | "createdAt";

const SORTABLE: Set<string> = new Set([
  "itemType",
  "categoryName",
  "subCategory",
  "name",
  "assetTag",
  "serialNumber",
  "acquisitionCost",
  "currentDepreciatedValue",
  "acquisitionMethod",
  "projectRef",
  "yearAcquired",
  "acquisitionCondition",
  "registerStatus",
  "assignedToName",
  "department",
  "siteName",
  "physicalCondition",
  "lastCheckedAt",
  "notes",
  "createdAt",
]);

export default function Assets() {
  const [location, setLocation] = useLocation();
  const { canEditAssets } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<string>("50");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "table";
    return window.localStorage.getItem("viewMode_assets") === "card" ? "card" : "table";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    const sid = qs.get("siteId");
    if (sid && !Number.isNaN(Number(sid))) {
      setSiteFilter(sid);
    }
  }, [location]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [createFormError, setCreateFormError] = useState("");

  const limit =
    pageSize === "all" ? 50_000 : Number.parseInt(pageSize, 10) || 50;
  const offset = page * limit;

  const listInput = useMemo(
    () => ({
      siteId: siteFilter !== "all" ? Number(siteFilter) : undefined,
      categoryId: categoryFilter !== "all" ? Number(categoryFilter) : undefined,
      registerStatus: statusFilter !== "all" ? statusFilter : undefined,
      itemType: itemTypeFilter !== "all" ? itemTypeFilter : undefined,
      search: searchTerm.trim() || undefined,
      sortBy,
      sortDir,
      limit,
      offset,
    }),
    [
      siteFilter,
      categoryFilter,
      statusFilter,
      itemTypeFilter,
      searchTerm,
      sortBy,
      sortDir,
      limit,
      offset,
    ]
  );

  const { data: registerData, isLoading, refetch } = trpc.assets.registerList.useQuery(listInput);

  const { data: sites } = trpc.sites.list.useQuery();
  const { data: categories } = trpc.assetCategories.list.useQuery();

  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);

  const utils = trpc.useUtils();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    document.title = "Asset Register | NRCS EAM";
    return () => {
      document.title = "NRCS Enterprise Asset Management System";
    };
  }, []);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, statusFilter, categoryFilter, siteFilter, itemTypeFilter, pageSize]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("viewMode_assets", viewMode);
    }
  }, [viewMode]);

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloading(true);
      const result = await utils.client.bulkOperations.getImportTemplate.query({ entity: "assets" });
      if (result) {
        const blob = new Blob([Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))], {
          type: result.mimeType,
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.filename;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Template downloaded");
      }
    } catch (error: unknown) {
      toast.error(`Failed to download template: ${error instanceof Error ? error.message : "error"}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const siteLabel =
        siteFilter !== "all"
          ? sites?.find((s) => s.id === Number(siteFilter))?.name ?? "All_Sites"
          : "All_Sites";
      const result = await utils.client.bulkOperations.exportAssetRegister.query({
        siteId: siteFilter !== "all" ? Number(siteFilter) : undefined,
        categoryId: categoryFilter !== "all" ? Number(categoryFilter) : undefined,
        registerStatus: statusFilter !== "all" ? statusFilter : undefined,
        itemType: itemTypeFilter !== "all" ? itemTypeFilter : undefined,
        search: searchTerm.trim() || undefined,
        siteLabel,
      });
      if (result) {
        const blob = new Blob([Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))], {
          type: result.mimeType,
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.filename;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Export started");
      }
    } catch (error: unknown) {
      toast.error(`Export failed: ${error instanceof Error ? error.message : "error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const previewImportMutation = trpc.bulkOperations.previewAssetRegisterImport.useMutation({
    onSuccess: (data) => {
      setImportPreview(data);
      toast.success("File parsed — review rows below");
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmImportMutation = trpc.bulkOperations.confirmAssetRegisterImport.useMutation({
    onSuccess: (res) => {
      toast.success(`Imported ${res.imported}, skipped ${res.skipped}`);
      if (res.errors?.length) {
        toast.error(`${res.errors.length} row errors`);
      }
      setIsImportDialogOpen(false);
      setImportFile(null);
      setImportPreview(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleParseImport = () => {
    if (!importFile) {
      toast.error("Please select a file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result as string;
      const base64Data = data.split(",")[1];
      previewImportMutation.mutate({ fileData: base64Data });
    };
    reader.readAsDataURL(importFile);
  };

  const createAssetMutation = trpc.assets.create.useMutation({
    onSuccess: () => {
      toast.success("Asset created successfully");
      setCreateFormError("");
      setIsCreateDialogOpen(false);
      refetch();
      resetNewAssetForm();
    },
    onError: (error: { message?: string }) => {
      toast.error(`Failed to create asset: ${error.message}`);
    },
  });

  const bulkDeleteMutation = trpc.assets.bulkDelete.useMutation({
    onSuccess: () => {
      toast.success("Asset deleted");
      setDeleteTarget(null);
      refetch();
    },
    onError: (error: { message?: string }) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const updateAssetMutation = trpc.assets.update.useMutation({
    onSuccess: () => {
      toast.success("Asset updated successfully");
      setIsEditDialogOpen(false);
      setEditingAsset(null);
      refetch();
    },
    onError: (error: { message?: string }) => {
      toast.error(`Failed to update asset: ${error.message}`);
    },
  });

  const resetNewAssetForm = () => {
    setNewAsset({
      assetTag: "",
      name: "",
      description: "",
      categoryId: "",
      siteId: "",
      itemType: "asset",
      subCategory: "",
      serialNumber: "",
      acquisitionCost: "",
      currentDepreciatedValue: "",
      acquisitionMethod: "",
      projectRef: "",
      yearAcquired: "",
      acquisitionCondition: "New",
      registerStatus: "in_use",
      assignedToName: "",
      department: "",
      location: "",
      physicalCondition: "Good",
      notes: "",
    });
  };

  const [newAsset, setNewAsset] = useState({
    assetTag: "",
    name: "",
    description: "",
    categoryId: "",
    siteId: "",
    itemType: "asset" as "asset" | "inventory",
    subCategory: "",
    serialNumber: "",
    acquisitionCost: "",
    currentDepreciatedValue: "",
    acquisitionMethod: "",
    projectRef: "",
    yearAcquired: "",
    acquisitionCondition: "New" as "New" | "Used",
    registerStatus: "in_use",
    assignedToName: "",
    department: "",
    location: "",
    physicalCondition: "Good" as "Good" | "Fair" | "Damaged" | "Beyond Repair",
    notes: "",
  });

  const handleCreateAsset = () => {
    setCreateFormError("");
    if (!newAsset.name || !newAsset.categoryId || !newAsset.siteId) {
      const msg = "Please fill in required fields (description, category, facility)";
      setCreateFormError(msg);
      toast.error(msg);
      return;
    }
    const year = newAsset.yearAcquired ? Number(newAsset.yearAcquired) : undefined;
    if (newAsset.yearAcquired && (Number.isNaN(year!) || year! < 1900)) {
      toast.error("Invalid year acquired");
      return;
    }
    const showProject =
      newAsset.acquisitionMethod === "Purchased Through Project" && newAsset.projectRef.trim();
    createAssetMutation.mutate({
      assetTag: newAsset.assetTag.trim() || undefined,
      name: newAsset.name,
      description: newAsset.description || undefined,
      categoryId: Number(newAsset.categoryId),
      siteId: Number(newAsset.siteId),
      itemType: newAsset.itemType,
      subCategory: newAsset.subCategory || undefined,
      serialNumber: newAsset.serialNumber || undefined,
      acquisitionCost: newAsset.acquisitionCost || undefined,
      currentDepreciatedValue: newAsset.currentDepreciatedValue
        ? Number(newAsset.currentDepreciatedValue)
        : undefined,
      acquisitionMethod: newAsset.acquisitionMethod || undefined,
      projectRef: showProject ? newAsset.projectRef : newAsset.projectRef || undefined,
      yearAcquired: year,
      acquisitionCondition: newAsset.acquisitionCondition,
      registerStatus: newAsset.registerStatus as
        | "in_use"
        | "in_store"
        | "under_maintenance"
        | "disposed"
        | "to_be_disposed"
        | "out_of_order"
        | "beyond_repair",
      assignedToName: newAsset.assignedToName || undefined,
      department: newAsset.department || undefined,
      location: newAsset.location || undefined,
      physicalCondition: newAsset.physicalCondition,
      notes: newAsset.notes || undefined,
    });
  };

  const handleStartEdit = (asset: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingAsset({
      id: asset.id,
      assetTag: asset.assetTag,
      name: asset.name,
      description: asset.description || "",
      categoryId: asset.categoryId?.toString() || "",
      siteId: asset.siteId?.toString() || "",
      manufacturer: asset.manufacturer || "",
      model: asset.model || "",
      serialNumber: asset.serialNumber || "",
      location: asset.location || "",
      status: asset.status,
      registerStatus: asset.registerStatus || "in_use",
      itemType: asset.itemType || "asset",
      subCategory: asset.subCategory || "",
      acquisitionMethod: asset.acquisitionMethod || "",
      projectRef: asset.projectRef || "",
      acquisitionCondition: asset.acquisitionCondition || "New",
      department: asset.department || "",
      assignedToName: asset.assignedToName || "",
      physicalCondition: asset.physicalCondition || "Good",
      notes: asset.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingAsset.assetTag || !editingAsset.name || !editingAsset.categoryId || !editingAsset.siteId) {
      toast.error("Please fill in all required fields");
      return;
    }
    updateAssetMutation.mutate({
      id: editingAsset.id,
      assetTag: editingAsset.assetTag,
      name: editingAsset.name,
      description: editingAsset.description || undefined,
      categoryId: Number(editingAsset.categoryId),
      siteId: Number(editingAsset.siteId),
      manufacturer: editingAsset.manufacturer || undefined,
      model: editingAsset.model || undefined,
      serialNumber: editingAsset.serialNumber || undefined,
      location: editingAsset.location || undefined,
      registerStatus: editingAsset.registerStatus,
      itemType: editingAsset.itemType,
      subCategory: editingAsset.subCategory || undefined,
      acquisitionMethod: editingAsset.acquisitionMethod || undefined,
      projectRef: editingAsset.projectRef || undefined,
      acquisitionCondition: editingAsset.acquisitionCondition,
      department: editingAsset.department || undefined,
      assignedToName: editingAsset.assignedToName || undefined,
      physicalCondition: editingAsset.physicalCondition,
      notes: editingAsset.notes || undefined,
    });
  };

  const toggleSort = (key: SortKey) => {
    if (!SORTABLE.has(key)) return;
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const rows = registerData?.rows ?? [];
  const total = registerData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));


  const sortIndicator = (key: SortKey) => {
    if (sortBy !== key) return <span className="text-muted-foreground opacity-40">↕</span>;
    return <span className="text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="asset-register-heading">
            Asset Register
          </h1>
          <p className="text-muted-foreground mt-2">
            NRCS asset register — spreadsheet view with filters and Excel import/export
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            {canEditAssets ? (
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={(open) => {
                setIsCreateDialogOpen(open);
                if (!open) setCreateFormError("");
              }}
            >
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Asset</DialogTitle>
                  <DialogDescription>
                    Create a register entry (asset tag is optional — auto-generated if empty)
                  </DialogDescription>
                </DialogHeader>
                {createFormError ? (
                  <p data-testid="form-error" className="text-sm text-destructive">
                    {createFormError}
                  </p>
                ) : null}
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Item Type *</Label>
                      <Select
                        value={newAsset.itemType}
                        onValueChange={(v) =>
                          setNewAsset({ ...newAsset, itemType: v as "asset" | "inventory" })
                        }
                      >
                        <SelectTrigger data-testid="asset-form-item-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asset">Asset</SelectItem>
                          <SelectItem value="inventory">Inventory</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Item Category *</Label>
                      <Select
                        value={newAsset.categoryId}
                        onValueChange={(value) => setNewAsset({ ...newAsset, categoryId: value })}
                      >
                        <SelectTrigger data-testid="asset-form-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subCategory">Sub-Item Category</Label>
                    <Input
                      id="subCategory"
                      data-testid="asset-form-subcategory"
                      value={newAsset.subCategory}
                      onChange={(e) => setNewAsset({ ...newAsset, subCategory: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Item Description *</Label>
                    <Textarea
                      id="name"
                      data-testid="asset-form-description"
                      value={newAsset.name}
                      onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                      placeholder="Full item description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="assetTag">Asset Code (optional)</Label>
                      <Input
                        id="assetTag"
                        value={newAsset.assetTag}
                        onChange={(e) => setNewAsset({ ...newAsset, assetTag: e.target.value })}
                        placeholder="Auto-generated if empty"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serialNumber">Serial / Product No.</Label>
                      <Input
                        id="serialNumber"
                        data-testid="asset-form-serial"
                        value={newAsset.serialNumber}
                        onChange={(e) => setNewAsset({ ...newAsset, serialNumber: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Actual Unit Value (NGN)</Label>
                      <Input
                        data-testid="asset-form-unit-value"
                        type="number"
                        value={newAsset.acquisitionCost}
                        onChange={(e) => setNewAsset({ ...newAsset, acquisitionCost: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Current Depreciated Value (NGN)</Label>
                      <Input
                        data-testid="asset-form-depreciated-value"
                        type="number"
                        value={newAsset.currentDepreciatedValue}
                        onChange={(e) =>
                          setNewAsset({ ...newAsset, currentDepreciatedValue: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Method of Acquisition</Label>
                    <Select
                      value={newAsset.acquisitionMethod || "__none__"}
                      onValueChange={(v) =>
                        setNewAsset({
                          ...newAsset,
                          acquisitionMethod: v === "__none__" ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger data-testid="asset-form-acquisition-method">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {ACQUISITION_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newAsset.acquisitionMethod === "Purchased Through Project" ? (
                    <div className="space-y-2">
                      <Label>Project Reference</Label>
                      <Input
                        data-testid="asset-form-project-ref"
                        value={newAsset.projectRef}
                        onChange={(e) => setNewAsset({ ...newAsset, projectRef: e.target.value })}
                      />
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="year">Year Acquired</Label>
                      <Input
                        id="year"
                        data-testid="asset-form-year"
                        type="number"
                        value={newAsset.yearAcquired}
                        onChange={(e) => setNewAsset({ ...newAsset, yearAcquired: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Acquired New or Used</Label>
                      <RadioGroup
                        value={newAsset.acquisitionCondition}
                        onValueChange={(v) =>
                          setNewAsset({ ...newAsset, acquisitionCondition: v as "New" | "Used" })
                        }
                        className="flex gap-4 pt-2"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="New" id="new" data-testid="asset-form-new-used-new" />
                          <Label htmlFor="new">New</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="Used" id="used" data-testid="asset-form-new-used-used" />
                          <Label htmlFor="used">Used</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Current Status</Label>
                      <Select
                        value={newAsset.registerStatus}
                        onValueChange={(v) => setNewAsset({ ...newAsset, registerStatus: v })}
                      >
                        <SelectTrigger data-testid="asset-form-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REGISTER_STATUS_FILTER.filter((x) => x.value !== "all").map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Facility / location *</Label>
                      <Select
                        value={newAsset.siteId}
                        onValueChange={(value) => setNewAsset({ ...newAsset, siteId: value })}
                      >
                        <SelectTrigger data-testid="asset-form-site">
                          <SelectValue placeholder="Select facility" />
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Assigned To</Label>
                      <Input
                        data-testid="asset-form-assigned"
                        value={newAsset.assignedToName}
                        onChange={(e) => setNewAsset({ ...newAsset, assignedToName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input
                        data-testid="asset-form-department"
                        value={newAsset.department}
                        onChange={(e) => setNewAsset({ ...newAsset, department: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Location detail</Label>
                    <Input
                      value={newAsset.location}
                      onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })}
                      placeholder="Building, floor, room"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select
                      value={newAsset.physicalCondition}
                      onValueChange={(v) =>
                        setNewAsset({
                          ...newAsset,
                          physicalCondition: v as typeof newAsset.physicalCondition,
                        })
                      }
                    >
                      <SelectTrigger data-testid="asset-form-condition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["Good", "Fair", "Damaged", "Beyond Repair"] as const).map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Textarea
                      data-testid="asset-form-remarks"
                      value={newAsset.notes}
                      onChange={(e) => setNewAsset({ ...newAsset, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    data-testid="asset-form-submit"
                    onClick={handleCreateAsset}
                    disabled={createAssetMutation.isPending}
                  >
                    {createAssetMutation.isPending ? "Creating..." : "Create Asset"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            ) : null}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="asset-search-input"
                placeholder="Search description, code, serial..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 min-w-[260px] pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[170px]" data-testid="asset-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {REGISTER_STATUS_FILTER.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="h-9 w-[170px]" data-testid="asset-filter-site">
                <SelectValue placeholder="Facility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All facilities</SelectItem>
                {sites?.map((site) => (
                  <SelectItem key={site.id} value={site.id.toString()}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="Item type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="asset">Asset</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <ViewToggle value={viewMode} onChange={setViewMode} />
              <Button
                className="h-9"
                variant="outline"
                data-testid="asset-export-excel-btn"
                onClick={handleExportExcel}
                disabled={isExporting}
              >
                <Download className="mr-2 h-4 w-4" />
                Export to Excel
              </Button>
              {canEditAssets ? (
                <>
                  <Button className="h-9" variant="outline" onClick={handleDownloadTemplate} disabled={isDownloading}>
                    <Download className="mr-2 h-4 w-4" />
                    Template
                  </Button>
                  <Button className="h-9" variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </Button>
                  <Button className="h-9" onClick={() => setIsCreateDialogOpen(true)} data-testid="asset-create-btn">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Asset
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === "card" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="asset-list-cards">
          {rows.map((row) => (
            <Card
              key={row.id}
              className="cursor-pointer"
              onClick={() => setLocation(appPath(`/assets/${row.id}`))}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{row.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="font-mono text-xs text-muted-foreground">{row.assetTag}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{row.itemType === "inventory" ? "Inventory" : "Asset"}</Badge>
                  <Badge variant="secondary">{row.categoryName?.trim() || EM_DASH}</Badge>
                  <Badge variant="outline" className={cn("text-xs font-normal", STATUS_BADGE[row.registerStatus as string] ?? "")}>
                    {REGISTER_LABELS[row.registerStatus as string] ?? row.registerStatus}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{row.siteName || EM_DASH}</p>
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <CardQrCode
                    idValue={String(row.id)}
                    title={row.name}
                    subtitle={row.assetTag || `Asset #${row.id}`}
                    encodedValue={`https://nrcseam.techivano.com/app/assets/${row.id}`}
                    labelSize="50x50"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
      <div data-testid="asset-list-table" className="rounded-md border bg-card overflow-hidden px-2 md:px-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table
              className="w-max min-w-full border-collapse text-sm"
              data-testid="asset-register-data-table"
            >
              <thead className="sticky top-0 z-40 bg-background">
                <tr className="border-b">
                  <th
                    className="sticky left-0 z-[45] border-r bg-background px-2 py-1.5 text-left font-medium whitespace-nowrap w-[3rem] min-w-[3rem] max-w-[3rem]"
                    data-testid="asset-col-sno"
                  >
                    S/No
                  </th>
                  <th
                    className="sticky left-[3rem] z-[45] border-r bg-background px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[7rem] cursor-pointer"
                    data-testid="asset-col-asset-code"
                    onClick={() => toggleSort("assetTag")}
                  >
                    Asset Code {sortIndicator("assetTag")}
                  </th>
                  <th
                    className="sticky left-[10rem] z-[45] border-r bg-background px-2 py-1.5 text-left font-medium whitespace-nowrap w-[14rem] min-w-[14rem] max-w-[14rem] cursor-pointer shadow-[4px_0_8px_-4px_rgba(0,0,0,0.25)]"
                    data-testid="asset-col-description"
                    onClick={() => toggleSort("name")}
                  >
                    Item Description {sortIndicator("name")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[5.5rem] cursor-pointer"
                    onClick={() => toggleSort("itemType")}
                  >
                    Item Type {sortIndicator("itemType")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[8rem] cursor-pointer"
                    onClick={() => toggleSort("categoryName")}
                  >
                    Item Category {sortIndicator("categoryName")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[7rem] cursor-pointer"
                    onClick={() => toggleSort("subCategory")}
                  >
                    Sub-Item {sortIndicator("subCategory")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[7rem] cursor-pointer"
                    onClick={() => toggleSort("serialNumber")}
                  >
                    Serial / Product No. {sortIndicator("serialNumber")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-right font-medium whitespace-nowrap min-w-[8rem] cursor-pointer"
                    onClick={() => toggleSort("acquisitionCost")}
                  >
                    Actual Unit (NGN) {sortIndicator("acquisitionCost")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-right font-medium whitespace-nowrap min-w-[8rem] cursor-pointer"
                    onClick={() => toggleSort("currentDepreciatedValue")}
                  >
                    Depreciated (NGN) {sortIndicator("currentDepreciatedValue")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[9rem] cursor-pointer"
                    onClick={() => toggleSort("acquisitionMethod")}
                  >
                    Method {sortIndicator("acquisitionMethod")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[8rem] cursor-pointer"
                    onClick={() => toggleSort("projectRef")}
                  >
                    Project Ref {sortIndicator("projectRef")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[5rem] cursor-pointer"
                    onClick={() => toggleSort("yearAcquired")}
                  >
                    Year {sortIndicator("yearAcquired")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[5rem] cursor-pointer"
                    onClick={() => toggleSort("acquisitionCondition")}
                  >
                    New/Used {sortIndicator("acquisitionCondition")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[8rem] cursor-pointer"
                    onClick={() => toggleSort("registerStatus")}
                  >
                    Status {sortIndicator("registerStatus")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[8rem] cursor-pointer"
                    onClick={() => toggleSort("assignedToName")}
                  >
                    Assigned To {sortIndicator("assignedToName")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[7rem] cursor-pointer"
                    onClick={() => toggleSort("department")}
                  >
                    Department {sortIndicator("department")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[9rem] cursor-pointer"
                    onClick={() => toggleSort("siteName")}
                  >
                    Location {sortIndicator("siteName")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[6rem] cursor-pointer"
                    onClick={() => toggleSort("physicalCondition")}
                  >
                    Condition {sortIndicator("physicalCondition")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[7rem] cursor-pointer"
                    onClick={() => toggleSort("lastCheckedAt")}
                  >
                    Last Check {sortIndicator("lastCheckedAt")}
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium whitespace-nowrap min-w-[10rem] cursor-pointer"
                    onClick={() => toggleSort("notes")}
                  >
                    Remarks {sortIndicator("notes")}
                  </th>
                  {canEditAssets ? (
                    <th className="sticky right-0 z-[45] border-l bg-muted px-1 py-1.5 w-20 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]" />
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canEditAssets ? 21 : 20}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No rows match filters
                    </td>
                  </tr>
                ) : (
                  rows.map((row: (typeof rows)[number], i: number) => {
                    const rs = row.registerStatus as string;
                    const dep =
                      row.currentDepreciatedValue != null
                        ? Number(row.currentDepreciatedValue)
                        : row.currentValue != null
                          ? Number(row.currentValue)
                          : null;
                    const unit = row.acquisitionCost != null ? Number(row.acquisitionCost) : null;
                    const year = row.acquisitionDate
                      ? new Date(row.acquisitionDate).getFullYear()
                      : null;
                    const assigned =
                      row.assignedToName?.trim() ||
                      row.assignedUserName?.trim() ||
                      "";
                    const loc = [row.siteName, row.location].filter(Boolean).join(" / ");
                    const desc =
                      row.description?.trim() ? `${row.name} — ${row.description}` : row.name;
                    const statusLabel = REGISTER_LABELS[rs] ?? rs;
                    const cond = row.physicalCondition?.trim() || "";

                    return (
                      <tr
                        key={row.id}
                        data-testid={`asset-row-${row.id}`}
                        className={cn(
                          "relative z-10 border-b cursor-pointer hover:bg-muted/50",
                          i % 2 === 1 ? "bg-muted/30" : "bg-background"
                        )}
                        onClick={() => setLocation(appPath(`/assets/${row.id}`))}
                      >
                        <td className="sticky left-0 z-[35] border-r bg-background px-2 py-1 text-muted-foreground w-[3rem] min-w-[3rem] max-w-[3rem]">
                          {offset + i + 1}
                        </td>
                        <td
                          className="sticky left-[3rem] z-[35] border-r bg-background px-2 py-1 font-mono text-xs whitespace-nowrap min-w-[7rem]"
                        >
                          {row.assetTag}
                        </td>
                        <td
                          className="sticky left-[10rem] z-[35] border-r bg-background px-2 py-1 w-[14rem] min-w-[14rem] max-w-[14rem] truncate shadow-[4px_0_8px_-4px_rgba(0,0,0,0.25)]"
                          title={desc}
                          data-testid={`asset-cell-desc-${row.id}`}
                        >
                          {desc || EM_DASH}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          {row.itemType === "inventory" ? "Inventory" : "Asset"}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          {row.categoryName?.trim() || EM_DASH}
                        </td>
                        <td className="px-2 py-1 max-w-[10rem] truncate">{row.subCategory?.trim() || EM_DASH}</td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          {row.serialNumber?.trim() || EM_DASH}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                          {formatMoney(unit)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                          {formatMoney(dep)}
                        </td>
                        <td className="px-2 py-1 max-w-[10rem] truncate">
                          {row.acquisitionMethod?.trim() || EM_DASH}
                        </td>
                        <td className="px-2 py-1 max-w-[8rem] truncate">
                          {row.projectRef?.trim() || EM_DASH}
                        </td>
                        <td className="px-2 py-1">{year ?? EM_DASH}</td>
                        <td className="px-2 py-1">{row.acquisitionCondition?.trim() || EM_DASH}</td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs font-normal",
                              STATUS_BADGE[rs] ?? "bg-slate-100 text-slate-800"
                            )}
                          >
                            {statusLabel}
                          </Badge>
                        </td>
                        <td className="px-2 py-1 max-w-[9rem] truncate">{assigned || EM_DASH}</td>
                        <td className="px-2 py-1 max-w-[8rem] truncate">
                          {row.department?.trim() || EM_DASH}
                        </td>
                        <td className="px-2 py-1 max-w-[12rem] truncate" title={loc}>
                          {loc || EM_DASH}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          {cond ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs font-normal",
                                CONDITION_BADGE[cond] ?? "bg-slate-100"
                              )}
                            >
                              {cond}
                            </Badge>
                          ) : (
                            EM_DASH
                          )}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          {formatDate(row.lastCheckedAt)}
                        </td>
                        <td className="px-2 py-1 max-w-[14rem] truncate" title={row.notes ?? ""}>
                          {row.notes?.trim() || EM_DASH}
                        </td>
                        {canEditAssets ? (
                          <td
                            className="sticky right-0 z-[35] border-l bg-background px-1 py-0.5 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex gap-0.5">
                              <Button
                                data-testid="asset-edit-btn"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => handleStartEdit(row, e)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                data-testid="asset-delete-btn"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDeleteTarget({ id: row.id, name: row.name });
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Rows per page</span>
            <Select value={pageSize} onValueChange={setPageSize}>
              <SelectTrigger className="h-8 w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span data-testid="asset-register-pagination">
              Page {page + 1} of {totalPages} ({total} rows)
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>Update asset register fields</DialogDescription>
          </DialogHeader>
          {editingAsset && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Asset Code *</Label>
                  <Input
                    value={editingAsset.assetTag}
                    onChange={(e) => setEditingAsset({ ...editingAsset, assetTag: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Item Description *</Label>
                  <Input
                    value={editingAsset.name}
                    onChange={(e) => setEditingAsset({ ...editingAsset, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes / long description</Label>
                <Textarea
                  value={editingAsset.description}
                  onChange={(e) => setEditingAsset({ ...editingAsset, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={editingAsset.categoryId}
                    onValueChange={(value) => setEditingAsset({ ...editingAsset, categoryId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Site *</Label>
                  <Select
                    value={editingAsset.siteId}
                    onValueChange={(value) => setEditingAsset({ ...editingAsset, siteId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Register status</Label>
                  <Select
                    value={editingAsset.registerStatus}
                    onValueChange={(value) => setEditingAsset({ ...editingAsset, registerStatus: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REGISTER_STATUS_FILTER.filter((x) => x.value !== "all").map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Item Type</Label>
                  <Select
                    value={editingAsset.itemType}
                    onValueChange={(v) => setEditingAsset({ ...editingAsset, itemType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">Asset</SelectItem>
                      <SelectItem value="inventory">Inventory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Manufacturer</Label>
                  <Input
                    value={editingAsset.manufacturer}
                    onChange={(e) => setEditingAsset({ ...editingAsset, manufacturer: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    value={editingAsset.model}
                    onChange={(e) => setEditingAsset({ ...editingAsset, model: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Serial Number</Label>
                  <Input
                    value={editingAsset.serialNumber}
                    onChange={(e) => setEditingAsset({ ...editingAsset, serialNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location detail</Label>
                  <Input
                    value={editingAsset.location}
                    onChange={(e) => setEditingAsset({ ...editingAsset, location: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              data-testid="asset-form-submit"
              onClick={handleSaveEdit}
              disabled={updateAssetMutation.isPending}
            >
              {updateAssetMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteTarget?.name ?? "this asset"} from the registry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="asset-delete-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  bulkDeleteMutation.mutate({ ids: [deleteTarget.id] });
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isImportDialogOpen}
        onOpenChange={(o) => {
          setIsImportDialogOpen(o);
          if (!o) {
            setImportPreview(null);
            setImportFile(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Asset Register</DialogTitle>
            <DialogDescription>
              Upload NRCS-format .xlsx — preview and confirm valid rows
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="import-file">Select Excel File</Label>
              <Input
                id="import-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] || null);
                  setImportPreview(null);
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleParseImport} disabled={!importFile || previewImportMutation.isPending}>
                {previewImportMutation.isPending ? "Parsing..." : "Preview"}
              </Button>
              {importPreview?.rows?.length ? (
                <Button
                  onClick={() => {
                    const ok = importPreview.rows
                      .filter((r: { payload: unknown; errors: string[] }) => r.payload && r.errors.length === 0)
                      .map((r: { payload: unknown }) => r.payload);
                    if (!ok.length) {
                      toast.error("No valid rows to import");
                      return;
                    }
                    confirmImportMutation.mutate({ rows: ok });
                  }}
                  disabled={confirmImportMutation.isPending}
                >
                  {confirmImportMutation.isPending ? "Importing..." : "Confirm import"}
                </Button>
              ) : null}
            </div>
            {importPreview?.rows?.length ? (
              <div className="border rounded-md overflow-auto max-h-64 text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-1 text-left">Row</th>
                      <th className="p-1 text-left">OK</th>
                      <th className="p-1 text-left">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.map((r: { sheetRow: number; errors: string[]; payload: unknown }) => (
                      <tr key={r.sheetRow} className="border-t">
                        <td className="p-1">{r.sheetRow}</td>
                        <td className="p-1">{r.payload ? "Yes" : "No"}</td>
                        <td className="p-1">{r.errors?.join("; ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
