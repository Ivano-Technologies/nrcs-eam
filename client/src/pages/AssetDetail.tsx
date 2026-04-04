import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Package, MapPin, Calendar, DollarSign, QrCode, Download, Upload, Image as ImageIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import AssetDepreciation from "@/components/AssetDepreciation";
import { AssetMaintenanceTimeline } from "@/components/AssetMaintenanceTimeline";

export default function AssetDetail() {
  const [, params] = useRoute("/assets/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [photoCaption, setPhotoCaption] = useState('');

  const assetId = params?.id ? Number(params.id) : 0;
  const { data: asset, isLoading, refetch } = trpc.assets.getById.useQuery({ id: assetId });
  const { data: photos, refetch: refetchPhotos } = trpc.photos.listByAsset.useQuery({ assetId }, { enabled: !!assetId });

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
    manufacturer: "",
    model: "",
    serialNumber: "",
    location: "",
    notes: "",
  });

  const handleEdit = () => {
    if (asset) {
      setEditForm({
        name: asset.name,
        description: asset.description || "",
        status: asset.status,
        manufacturer: asset.manufacturer || "",
        model: asset.model || "",
        serialNumber: asset.serialNumber || "",
        location: asset.location || "",
        notes: asset.notes || "",
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleUpdate = () => {
    updateAssetMutation.mutate({
      id: assetId,
      name: editForm.name || undefined,
      description: editForm.description || undefined,
      status: editForm.status as any,
      manufacturer: editForm.manufacturer || undefined,
      model: editForm.model || undefined,
      serialNumber: editForm.serialNumber || undefined,
      location: editForm.location || undefined,
      notes: editForm.notes || undefined,
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

  const canEdit = user?.role === "admin" || user?.role === "manager";

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
        <Button onClick={() => setLocation("/assets")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Assets
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/assets")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{asset.name}</h1>
            <p className="text-muted-foreground mt-1">{asset.assetTag}</p>
          </div>
          <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
        </div>
        {canEdit && (
          <Button onClick={handleEdit}>
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
                  <p className="text-base">₦{parseFloat(asset.acquisitionCost).toLocaleString()}</p>
                </div>
              </div>
            )}
            {asset.currentValue && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Value</p>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <p className="text-base">₦{parseFloat(asset.currentValue).toLocaleString()}</p>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>Update asset information</DialogDescription>
          </DialogHeader>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateAssetMutation.isPending}>
              {updateAssetMutation.isPending ? "Updating..." : "Update Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
