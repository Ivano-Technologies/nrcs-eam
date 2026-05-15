import { useMemo, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Edit,
  Package,
  MapPin,
  Calendar,
  DollarSign,
  QrCode,
  Download,
  Upload,
  Image as ImageIcon,
  X,
  ChevronDown,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { usePermissions } from "@/_core/hooks/usePermissions";
import AssetDepreciation from "@/components/AssetDepreciation";
import { AssetMaintenanceTimeline } from "@/components/AssetMaintenanceTimeline";
import { formatNaira } from "@/lib/format";
import { calculateDepreciatedValue } from "@/lib/depreciation";
import {
  CONDITION_OPTIONS,
  CURRENT_STATUS_OPTIONS,
  METHOD_OF_ACQUISITION_OPTIONS,
  SUB_ITEM_CATEGORIES,
} from "@/lib/assetRegisterOptions";

function categoryIdForCanonicalName(
  categories: { id: number; name: string }[] | undefined,
  canonical: string | null
): string {
  if (!canonical || !categories?.length) return "";
  const row = categories.find((c) => c.name === canonical);
  return row ? String(row.id) : "";
}

function parseAssetEditChanges(raw: string | null | undefined): {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changedFields: string[];
} | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { before?: unknown; after?: unknown; changedFields?: unknown };
    const before =
      typeof o.before === "object" && o.before !== null ? (o.before as Record<string, unknown>) : {};
    const after =
      typeof o.after === "object" && o.after !== null ? (o.after as Record<string, unknown>) : {};
    const changedFields = Array.isArray(o.changedFields)
      ? o.changedFields.filter((x): x is string => typeof x === "string")
      : [];
    return { before, after, changedFields };
  } catch {
    return null;
  }
}

function formatAuditCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const REGISTER_STATUS_EDIT_OPTIONS = [
  { value: "in_use", label: "In Use" },
  { value: "in_store", label: "In Store" },
  { value: "under_maintenance", label: "Under Maintenance" },
  { value: "disposed", label: "Disposed" },
  { value: "to_be_disposed", label: "To be Disposed" },
  { value: "out_of_order", label: "Out of Order" },
  { value: "beyond_repair", label: "Beyond Repair" },
] as const;

export default function AssetDetail() {
  const [, params] = useRoute("/app/assets/:id");
  const [, setLocation] = useLocation();
  const { canEditAssets } = usePermissions();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [photoCaption, setPhotoCaption] = useState('');

  const assetId = params?.id ? Number(params.id) : 0;
  const { data: asset, isLoading, refetch } = trpc.assets.getById.useQuery({ id: assetId });
  const { data: photos, refetch: refetchPhotos } = trpc.photos.listByAsset.useQuery({ assetId }, { enabled: !!assetId });
  const { data: categories } = trpc.assetCategories.list.useQuery();
  const { data: sites } = trpc.sites.list.useQuery();
  const { data: editHistory } = trpc.assets.listAssetEditHistory.useQuery(
    { assetId },
    { enabled: !!assetId && canEditAssets && historyOpen }
  );

  const utils = trpc.useUtils();

  const generateQRCodeMutation = trpc.assets.generateQRCode.useMutation({
    onSuccess: () => {
      toast.success("QR Code generated successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to generate QR code: ${error.message}`);
    },
  });

  const updateAssetMutation = trpc.assets.update.useMutation({
    onSuccess: () => {
      toast.success("Asset updated successfully");
      setIsEditDialogOpen(false);
      void utils.assets.listAssetEditHistory.invalidate({ assetId });
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update asset: ${error.message}`);
    },
  });

  const createPhotoMutation = trpc.photos.create.useMutation({
    onSuccess: () => {
      toast.success("Photo uploaded successfully");
      refetchPhotos();
    },
    onError: (error) => {
      toast.error(`Failed to upload photo: ${error.message}`);
    },
  });

  const deletePhotoMutation = trpc.photos.delete.useMutation({
    onSuccess: () => {
      toast.success("Photo deleted successfully");
      refetchPhotos();
    },
    onError: (error) => {
      toast.error(`Failed to delete photo: ${error.message}`);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB limit`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setPendingFiles(validFiles);
      setIsUploadDialogOpen(true);
    }
    e.target.value = '';
  };

  const handleUploadWithCaption = async () => {
    if (pendingFiles.length === 0) return;

    setUploadingPhoto(true);
    try {
      for (const file of pendingFiles) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error(`Upload failed for ${file.name}`);

        const { url, key } = await response.json();

        await createPhotoMutation.mutateAsync({
          assetId,
          photoUrl: url,
          photoKey: key,
          caption: photoCaption || undefined,
        });
      }
      toast.success(`Successfully uploaded ${pendingFiles.length} photo(s)`);
      setIsUploadDialogOpen(false);
      setPendingFiles([]);
      setPhotoCaption('');
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = (photoId: number) => {
    if (confirm('Are you sure you want to delete this photo?')) {
      deletePhotoMutation.mutate({ id: photoId });
    }
  };

  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    status: "",
    categoryId: "",
    siteId: "",
    registerStatus: "in_use",
    itemType: "asset" as "asset" | "inventory",
    registerItemType: "Asset" as "Asset" | "Inventory",
    itemDescription: "",
    subCategory: "",
    subItemCategory: "",
    branchCode: "",
    itemCategoryCode: "",
    assetNum: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    location: "",
    notes: "",
    acquisitionMethod: "",
    acquisitionOtherDetail: "",
    projectRef: "",
    acquisitionCondition: "New" as "New" | "Used",
    acquiredNewOrUsed: "New" as "New" | "Used",
    currentStatus: "In Use",
    department: "",
    assignedToName: "",
    physicalCondition: "Good" as "Good" | "Fair" | "Damaged" | "Beyond Repair",
    conditionRegister: "Good",
    lastPhysicalCheck: "",
    checkConductedBy: "",
    remarksRegister: "",
    actualUnitValue: "",
    yearAcquiredRegister: "",
    depreciatedValue: "",
    depreciationManualOverride: false,
    depreciationMethod: "",
    usefulLifeYears: "",
    residualValue: "",
    depreciationStartDate: "",
    latitude: "",
    longitude: "",
  });

  const computedEditDepreciation = useMemo(() => {
    if (editForm.depreciationManualOverride) return null;
    const actual = Number(editForm.actualUnitValue);
    const year = editForm.yearAcquiredRegister ? Number(editForm.yearAcquiredRegister) : NaN;
    const catName = categories?.find((c) => String(c.id) === editForm.categoryId)?.name?.trim() || "";
    if (!Number.isFinite(actual) || !Number.isFinite(year) || !catName) return null;
    return calculateDepreciatedValue(actual, catName, year);
  }, [
    editForm.depreciationManualOverride,
    editForm.actualUnitValue,
    editForm.yearAcquiredRegister,
    editForm.categoryId,
    categories,
  ]);

  const handleEdit = () => {
    if (!asset) return;
    setEditForm({
      name: asset.name,
      description: asset.description || "",
      status: asset.status,
      categoryId: asset.categoryId != null ? String(asset.categoryId) : "",
      siteId: asset.siteId != null ? String(asset.siteId) : "",
      registerStatus: asset.registerStatus || "in_use",
      itemType: (asset.itemType as "asset" | "inventory") || "asset",
      registerItemType: (asset.registerItemType as "Asset" | "Inventory") || "Asset",
      itemDescription: asset.itemDescription || "",
      subCategory: asset.subCategory || "",
      subItemCategory: asset.subItemCategory || "",
      branchCode: asset.branchCode || "",
      itemCategoryCode: asset.itemCategoryCode || "",
      assetNum: asset.assetNum != null ? String(asset.assetNum) : "",
      manufacturer: asset.manufacturer || "",
      model: asset.model || "",
      serialNumber: asset.serialNumber || "",
      location: asset.location || "",
      notes: asset.notes || "",
      acquisitionMethod: asset.acquisitionMethod || "",
      acquisitionOtherDetail: asset.acquisitionOtherDetail || "",
      projectRef: asset.projectRef || "",
      acquisitionCondition: (asset.acquisitionCondition as "New" | "Used") || "New",
      acquiredNewOrUsed: (asset.acquiredNewOrUsed as "New" | "Used") || (asset.acquisitionCondition as "New" | "Used") || "New",
      currentStatus: asset.currentStatus || "In Use",
      department: asset.department || "",
      assignedToName: asset.assignedToName || "",
      physicalCondition: (asset.physicalCondition as typeof editForm.physicalCondition) || "Good",
      conditionRegister: asset.conditionRegister || "Good",
      lastPhysicalCheck: asset.lastPhysicalCheck ? String(asset.lastPhysicalCheck).slice(0, 10) : "",
      checkConductedBy: asset.checkConductedBy || "",
      remarksRegister: asset.remarksRegister || "",
      actualUnitValue: asset.actualUnitValue != null ? String(asset.actualUnitValue) : "",
      yearAcquiredRegister: asset.yearAcquiredRegister != null ? String(asset.yearAcquiredRegister) : "",
      depreciatedValue:
        asset.depreciatedValue != null
          ? String(asset.depreciatedValue)
          : asset.currentDepreciatedValue != null
            ? String(asset.currentDepreciatedValue)
            : "",
      depreciationManualOverride: Boolean(asset.depreciatedValueManualOverride),
      depreciationMethod: asset.depreciationMethod || "",
      usefulLifeYears: asset.usefulLifeYears != null ? String(asset.usefulLifeYears) : "",
      residualValue: asset.residualValue != null ? String(asset.residualValue) : "",
      depreciationStartDate: asset.depreciationStartDate
        ? new Date(asset.depreciationStartDate).toISOString().slice(0, 10)
        : "",
      latitude: asset.latitude != null ? String(asset.latitude) : "",
      longitude: asset.longitude != null ? String(asset.longitude) : "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editForm.name.trim() || !editForm.categoryId || !editForm.siteId) {
      toast.error("Name, category, and facility are required.");
      return;
    }
    const cat = categories?.find((c) => String(c.id) === editForm.categoryId);
    if (!cat?.name?.trim()) {
      toast.error("Select a valid category.");
      return;
    }
    let currentStatusVal: (typeof CURRENT_STATUS_OPTIONS)[number] | undefined;
    if (
      editForm.currentStatus &&
      (CURRENT_STATUS_OPTIONS as readonly string[]).includes(editForm.currentStatus)
    ) {
      currentStatusVal = editForm.currentStatus as (typeof CURRENT_STATUS_OPTIONS)[number];
    } else {
      currentStatusVal = undefined;
    }
    updateAssetMutation.mutate({
      id: assetId,
      name: editForm.name,
      description: editForm.description || undefined,
      status: editForm.status as "operational" | "maintenance" | "repair" | "retired" | "disposed",
      categoryId: Number(editForm.categoryId),
      siteId: Number(editForm.siteId),
      registerStatus: editForm.registerStatus as
        | "in_use"
        | "in_store"
        | "under_maintenance"
        | "disposed"
        | "to_be_disposed"
        | "out_of_order"
        | "beyond_repair",
      itemType: editForm.itemType,
      registerItemType: editForm.registerItemType,
      itemDescription: editForm.itemDescription || undefined,
      itemCategory: cat.name.trim(),
      subCategory: editForm.subCategory || undefined,
      subItemCategory: editForm.subItemCategory || undefined,
      branchCode: editForm.branchCode || undefined,
      itemCategoryCode:
        editForm.itemCategoryCode && String(editForm.itemCategoryCode).trim().length === 2
          ? String(editForm.itemCategoryCode).trim().toUpperCase()
          : undefined,
      assetNum: editForm.assetNum ? Number(editForm.assetNum) : undefined,
      manufacturer: editForm.manufacturer || undefined,
      model: editForm.model || undefined,
      serialNumber: editForm.serialNumber || undefined,
      location: editForm.location || undefined,
      notes: editForm.notes || undefined,
      acquisitionMethod: editForm.acquisitionMethod || undefined,
      acquisitionOtherDetail: editForm.acquisitionOtherDetail || undefined,
      projectRef: editForm.projectRef || undefined,
      acquisitionCondition: editForm.acquisitionCondition,
      acquiredNewOrUsed: editForm.acquiredNewOrUsed,
      currentStatus: currentStatusVal,
      department: editForm.department || undefined,
      assignedToName: editForm.assignedToName || undefined,
      physicalCondition: editForm.physicalCondition,
      conditionRegister: editForm.conditionRegister as
        | "Good"
        | "Fair"
        | "Damaged"
        | "Beyond Repair (For Disposal)"
        | "Out of Order (To be repaired)",
      lastPhysicalCheck: editForm.lastPhysicalCheck
        ? new Date(`${editForm.lastPhysicalCheck}T12:00:00`)
        : undefined,
      checkConductedBy: editForm.checkConductedBy || undefined,
      remarksRegister: editForm.remarksRegister || undefined,
      actualUnitValue: editForm.actualUnitValue || undefined,
      yearAcquiredRegister: editForm.yearAcquiredRegister
        ? Number(editForm.yearAcquiredRegister)
        : undefined,
      depreciatedValue:
        editForm.depreciationManualOverride === true ? editForm.depreciatedValue || undefined : undefined,
      depreciatedValueManualOverride: editForm.depreciationManualOverride,
      currentDepreciatedValue:
        editForm.depreciationManualOverride === true && editForm.depreciatedValue
          ? Number(editForm.depreciatedValue)
          : undefined,
      depreciationMethod: editForm.depreciationMethod || undefined,
      usefulLifeYears: editForm.usefulLifeYears ? Number(editForm.usefulLifeYears) : undefined,
      residualValue: editForm.residualValue || undefined,
      depreciationStartDate: editForm.depreciationStartDate
        ? new Date(`${editForm.depreciationStartDate}T12:00:00`)
        : undefined,
      latitude: editForm.latitude?.trim() || undefined,
      longitude: editForm.longitude?.trim() || undefined,
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      operational: "bg-green-100 text-green-800",
      maintenance: "bg-yellow-100 text-yellow-800",
      repair: "bg-orange-100 text-orange-800",
      retired: "bg-gray-100 text-gray-800",
      disposed: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const canEdit = canEditAssets;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-xl text-muted-foreground">Asset not found</p>
        <Button onClick={() => setLocation("/app/assets")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Asset Register
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/app/assets")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="asset-detail-title">
              {asset.name}
            </h1>
            <p className="text-muted-foreground mt-1">{asset.assetTag}</p>
          </div>
          <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
        </div>
        {canEdit && (
          <Button data-testid="asset-detail-edit-btn" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Asset
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Asset Tag</p>
              <p className="text-base">{asset.assetTag}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-base">{asset.name}</p>
            </div>
            {asset.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="text-base">{asset.description}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Technical Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {asset.manufacturer && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Manufacturer</p>
                <p className="text-base">{asset.manufacturer}</p>
              </div>
            )}
            {asset.model && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Model</p>
                <p className="text-base">{asset.model}</p>
              </div>
            )}
            {asset.serialNumber && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Serial Number</p>
                <p className="text-base">{asset.serialNumber}</p>
              </div>
            )}
            {asset.location && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <p className="text-base">{asset.location}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {asset.acquisitionDate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Acquisition Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-base">{new Date(asset.acquisitionDate).toLocaleDateString()}</p>
                </div>
              </div>
            )}
            {asset.acquisitionCost && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Acquisition Cost</p>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <p className="text-base">{formatNaira(parseFloat(asset.acquisitionCost))}</p>
                </div>
              </div>
            )}
            {asset.currentValue && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Value</p>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <p className="text-base">{formatNaira(parseFloat(asset.currentValue))}</p>
                </div>
              </div>
            )}
            {asset.depreciationRate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Depreciation Rate</p>
                <p className="text-base">{asset.depreciationRate}% per year</p>
              </div>
            )}
            {asset.warrantyExpiry && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Warranty Expiry</p>
                <p className="text-base">{new Date(asset.warrantyExpiry).toLocaleDateString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>QR Code</CardTitle>
              {!asset.qrCode && canEdit && (
                <Button
                  size="sm"
                  onClick={() => generateQRCodeMutation.mutate({ id: asset.id })}
                  disabled={generateQRCodeMutation.isPending}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Generate QR Code
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {asset.qrCode ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={asset.qrCode}
                    alt="Asset QR Code"
                    className="w-48 h-48 border-2 border-border rounded-lg"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = asset.qrCode!;
                      link.download = `${asset.assetTag}-qr-code.png`;
                      link.click();
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.print()}
                  >
                    Print Label
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Scan this QR code to view asset details
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No QR code generated yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {asset.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base whitespace-pre-wrap">{asset.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Photo Gallery */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Asset Photos
            </CardTitle>
            {canEdit && (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="photo-upload"
                  disabled={uploadingPhoto}
                />
                <Button
                  size="sm"
                  onClick={() => document.getElementById('photo-upload')?.click()}
                  disabled={uploadingPhoto}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {photos && photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {photos.map((photo: any) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.photoUrl}
                    alt={photo.caption || 'Asset photo'}
                    className="w-full h-32 object-cover rounded-lg border-2 border-border cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setSelectedImage(photo.photoUrl)}
                  />
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeletePhoto(photo.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {photo.caption && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{photo.caption}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No photos uploaded yet
              </p>
              {canEdit && (
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Upload Photo" to add images
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Photo Preview</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Asset photo preview"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Depreciation Analysis */}
      {asset.depreciationMethod && asset.depreciationMethod !== 'none' && (
        <AssetDepreciation assetId={assetId} />
      )}

      {canEdit ? (
        <Card>
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CardHeader className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Edit History</CardTitle>
                  <CardDescription>
                    Register edits with field-level diffs (visible to Admin and Manager).
                  </CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" type="button">
                    {historyOpen ? "Hide" : "Show"}
                    <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 text-sm">
                {!editHistory?.length ? (
                  <p className="text-muted-foreground">No edit history recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {editHistory.map((entry) => {
                      const parsed = parseAssetEditChanges(entry.changes);
                      return (
                        <div key={entry.id} className="rounded-md border p-3 space-y-2">
                          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{entry.userLabel}</span>
                            <span>{new Date(entry.timestamp).toLocaleString()}</span>
                          </div>
                          {!parsed || parsed.changedFields.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No field diff stored for this entry.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left border-b">
                                    <th className="py-1 pr-2">Field</th>
                                    <th className="py-1 pr-2">Before</th>
                                    <th className="py-1">After</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {parsed.changedFields.map((f) => (
                                    <tr key={f} className="border-b border-border/50 align-top">
                                      <td className="py-1 pr-2 font-mono whitespace-nowrap">{f}</td>
                                      <td className="py-1 pr-2 break-all max-w-[200px]">
                                        {formatAuditCell(parsed.before[f])}
                                      </td>
                                      <td className="py-1 break-all max-w-[200px]">
                                        {formatAuditCell(parsed.after[f])}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ) : null}

      {/* Maintenance Timeline */}
      <AssetMaintenanceTimeline assetId={assetId} />

      {/* Photo Upload Dialog with Caption */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Photos</DialogTitle>
            <DialogDescription>
              {pendingFiles.length} photo(s) selected. Add an optional caption that will apply to all photos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="photo-caption">Caption (Optional)</Label>
              <Input
                id="photo-caption"
                placeholder="e.g., Front view, After maintenance, etc."
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Selected files:</p>
              <ul className="list-disc list-inside space-y-1">
                {pendingFiles.map((file, idx) => (
                  <li key={idx} className="truncate">{file.name}</li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsUploadDialogOpen(false);
                setPendingFiles([]);
                setPhotoCaption('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUploadWithCaption} disabled={uploadingPhoto}>
              {uploadingPhoto ? 'Uploading...' : `Upload ${pendingFiles.length} Photo(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-6">
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>
              Update operational fields and the full NRCS register record (Admin / Manager).
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-8rem)] pr-3">
            <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Asset Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                  <SelectItem value="disposed">Disposed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-manufacturer">Manufacturer</Label>
                <Input
                  id="edit-manufacturer"
                  value={editForm.manufacturer}
                  onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-model">Model</Label>
                <Input
                  id="edit-model"
                  value={editForm.model}
                  onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-serialNumber">Serial Number</Label>
                <Input
                  id="edit-serialNumber"
                  value={editForm.serialNumber}
                  onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={editForm.categoryId}
                  onValueChange={(v) => setEditForm({ ...editForm, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Facility *</Label>
                <Select
                  value={editForm.siteId}
                  onValueChange={(v) => setEditForm({ ...editForm, siteId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select facility" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sites ?? []).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
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
                  value={editForm.registerStatus}
                  onValueChange={(v) => setEditForm({ ...editForm, registerStatus: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGISTER_STATUS_EDIT_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Item type</Label>
                <Select
                  value={editForm.itemType}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, itemType: v as "asset" | "inventory" })
                  }
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
            <div className="space-y-2">
              <Label>Register item type</Label>
              <Select
                value={editForm.registerItemType}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, registerItemType: v as "Asset" | "Inventory" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asset">Asset</SelectItem>
                  <SelectItem value="Inventory">Inventory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Item description (register)</Label>
              <Input
                value={editForm.itemDescription}
                onChange={(e) => setEditForm({ ...editForm, itemDescription: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Sub-category</Label>
              <Input
                value={editForm.subCategory}
                onChange={(e) => setEditForm({ ...editForm, subCategory: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sub-item category</Label>
                <Select
                  value={editForm.subItemCategory || "__none__"}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, subItemCategory: v === "__none__" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {SUB_ITEM_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Branch code</Label>
                <Input
                  value={editForm.branchCode}
                  onChange={(e) => setEditForm({ ...editForm, branchCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Item category code</Label>
                <Input
                  maxLength={2}
                  value={editForm.itemCategoryCode}
                  onChange={(e) =>
                    setEditForm({ ...editForm, itemCategoryCode: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Asset #</Label>
                <Input
                  type="number"
                  value={editForm.assetNum}
                  onChange={(e) => setEditForm({ ...editForm, assetNum: e.target.value })}
                />
              </div>
            </div>
            <h3 className="text-sm font-semibold pt-2">Acquisition</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Method of acquisition</Label>
                <Select
                  value={editForm.acquisitionMethod || "__none__"}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, acquisitionMethod: v === "__none__" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {METHOD_OF_ACQUISITION_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editForm.acquisitionMethod === "Other" ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>Other acquisition detail</Label>
                  <Input
                    value={editForm.acquisitionOtherDetail}
                    onChange={(e) =>
                      setEditForm({ ...editForm, acquisitionOtherDetail: e.target.value })
                    }
                  />
                </div>
              ) : null}
              <div className="space-y-2 md:col-span-2">
                <Label>Project reference</Label>
                <Input
                  value={editForm.projectRef}
                  onChange={(e) => setEditForm({ ...editForm, projectRef: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Acquired new / used</Label>
                <Select
                  value={editForm.acquiredNewOrUsed}
                  onValueChange={(v) =>
                    setEditForm({
                      ...editForm,
                      acquiredNewOrUsed: v as "New" | "Used",
                      acquisitionCondition: v as "New" | "Used",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Used">Used</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <h3 className="text-sm font-semibold pt-2">Condition</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current status</Label>
                <Select
                  value={editForm.currentStatus}
                  onValueChange={(v) => setEditForm({ ...editForm, currentStatus: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENT_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Condition (register)</Label>
                <Select
                  value={editForm.conditionRegister}
                  onValueChange={(v) =>
                    setEditForm({
                      ...editForm,
                      conditionRegister: v,
                      physicalCondition:
                        v === "Beyond Repair (For Disposal)"
                          ? "Beyond Repair"
                          : v === "Out of Order (To be repaired)"
                            ? "Damaged"
                            : (v as "Good" | "Fair" | "Damaged" | "Beyond Repair"),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Last physical check</Label>
                <Input
                  type="date"
                  value={editForm.lastPhysicalCheck}
                  onChange={(e) => setEditForm({ ...editForm, lastPhysicalCheck: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Check conducted by</Label>
                <Input
                  value={editForm.checkConductedBy}
                  onChange={(e) => setEditForm({ ...editForm, checkConductedBy: e.target.value })}
                />
              </div>
            </div>
            <h3 className="text-sm font-semibold pt-2">Admin</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Remarks (register)</Label>
                <Textarea
                  value={editForm.remarksRegister}
                  onChange={(e) => setEditForm({ ...editForm, remarksRegister: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Assigned to (name)</Label>
                <Input
                  value={editForm.assignedToName}
                  onChange={(e) => setEditForm({ ...editForm, assignedToName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                />
              </div>
            </div>
            <h3 className="text-sm font-semibold pt-2">Map coordinates (optional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input
                  value={editForm.latitude}
                  onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input
                  value={editForm.longitude}
                  onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })}
                />
              </div>
            </div>
            <h3 className="text-sm font-semibold pt-2">Financial (register)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Actual unit value (NGN)</Label>
                <Input
                  type="number"
                  value={editForm.actualUnitValue}
                  onChange={(e) => setEditForm({ ...editForm, actualUnitValue: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Year acquired</Label>
                <Input
                  type="number"
                  min={1900}
                  max={2100}
                  value={editForm.yearAcquiredRegister}
                  onChange={(e) => setEditForm({ ...editForm, yearAcquiredRegister: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Depreciation method</Label>
                <Input
                  value={editForm.depreciationMethod}
                  onChange={(e) => setEditForm({ ...editForm, depreciationMethod: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Useful life (years)</Label>
                <Input
                  type="number"
                  value={editForm.usefulLifeYears}
                  onChange={(e) => setEditForm({ ...editForm, usefulLifeYears: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Residual value</Label>
                <Input
                  type="number"
                  value={editForm.residualValue}
                  onChange={(e) => setEditForm({ ...editForm, residualValue: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Depreciation start</Label>
                <Input
                  type="date"
                  value={editForm.depreciationStartDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, depreciationStartDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Depreciated value override</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Manual</span>
                  <Switch
                    checked={editForm.depreciationManualOverride}
                    onCheckedChange={(v) => setEditForm({ ...editForm, depreciationManualOverride: v })}
                  />
                </div>
              </div>
              {editForm.depreciationManualOverride ? (
                <Input
                  type="number"
                  value={editForm.depreciatedValue}
                  onChange={(e) => setEditForm({ ...editForm, depreciatedValue: e.target.value })}
                />
              ) : (
                <Input
                  readOnly
                  className="bg-muted"
                  value={
                    computedEditDepreciation != null
                      ? String(computedEditDepreciation)
                      : "— (set unit value, category, year)"
                  }
                />
              )}
            </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button data-testid="asset-detail-save-btn" onClick={handleUpdate} disabled={updateAssetMutation.isPending}>
              {updateAssetMutation.isPending ? "Updating..." : "Update Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
