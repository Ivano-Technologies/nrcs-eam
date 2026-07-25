import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Camera, MessageSquare, Loader2, ImagePlus } from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_SIZE_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function MobileWorkOrderDetail() {
  const [, params] = useRoute("/app/mobile-work-order/:id");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const autoPhotoTriggered = useRef(false);

  const workOrderId = params?.id ? Number(params.id) : 0;
  const { data: workOrder, isLoading, refetch } = trpc.workOrders.getById.useQuery({ id: workOrderId });
  const {
    data: photos = [],
    refetch: refetchPhotos,
    isLoading: photosLoading,
  } = trpc.workOrders.listPhotos.useQuery(
    { workOrderId },
    { enabled: workOrderId > 0 },
  );

  const uploadUrlMutation = trpc.workOrders.uploadUrl.useMutation();
  const attachPhotoMutation = trpc.workOrders.attachPhoto.useMutation();

  const updateMutation = trpc.workOrders.update.useMutation({
    onSuccess: () => {
      toast.success("Work order updated");
      refetch();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const uploadPhoto = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are allowed");
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Photo must be under ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    setUploading(true);
    try {
      const { uploadUrl, photoKey, publicUrl } = await uploadUrlMutation.mutateAsync({
        workOrderId,
        fileName: file.name || `wo-${workOrderId}.jpg`,
        fileType: file.type,
      });

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) {
        throw new Error("Storage upload failed");
      }

      await attachPhotoMutation.mutateAsync({
        workOrderId,
        photoUrl: publicUrl,
        photoKey,
      });
      toast.success("Photo uploaded");
      await refetchPhotos();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload photo";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadPhoto(file);
  };

  useEffect(() => {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    if (params.get("takePhoto") !== "1" || autoPhotoTriggered.current) return;
    if (!workOrder || workOrder.status !== "in_progress") return;
    autoPhotoTriggered.current = true;
    // Give the page a tick to paint before opening the camera sheet.
    const t = window.setTimeout(() => cameraInputRef.current?.click(), 250);
    return () => window.clearTimeout(t);
  }, [search, workOrder]);

  const handleStatusUpdate = (newStatus: string) => {
    updateMutation.mutate({
      id: workOrderId,
      status: newStatus as
        | "pending"
        | "assigned"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "cancelled",
      completionNotes: notes || undefined,
    });
  };

  const handleAddNotes = () => {
    if (!notes.trim()) {
      toast.error("Please enter notes");
      return;
    }
    updateMutation.mutate({
      id: workOrderId,
      completionNotes: notes,
    });
    setNotes("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="text-center py-8">Work order not found</div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const canAttachPhotos =
    workOrder.status === "in_progress" || workOrder.status === "completed";

  return (
    <div className="min-h-screen bg-gray-50">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        disabled={uploading || !canAttachPhotos}
        onChange={onFilePicked}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={uploading || !canAttachPhotos}
        onChange={onFilePicked}
      />

      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/app/mobile-work-orders")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Work Order #{workOrder.id}</h1>
            <p className="text-sm text-muted-foreground">{workOrder.title}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Status and Priority */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2 mb-4">
              <Badge className={getStatusColor(workOrder.status)}>
                {workOrder.status.replace("_", " ")}
              </Badge>
              <Badge className={getPriorityColor(workOrder.priority)} variant="outline">
                {workOrder.priority}
              </Badge>
            </div>

            {/* Quick Actions */}
            {workOrder.status === "pending" && (
              <Button
                className="w-full"
                onClick={() => handleStatusUpdate("in_progress")}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Start Work"
                )}
              </Button>
            )}

            {workOrder.status === "in_progress" && (
              <div className="space-y-2">
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Camera className="mr-2 h-4 w-4" />
                      Take Photo
                    </>
                  )}
                </Button>
                <Button
                  className="w-full"
                  variant="ghost"
                  disabled={uploading}
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Choose from gallery
                </Button>
                <Button
                  className="w-full"
                  onClick={() => handleStatusUpdate("completed")}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark Complete
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Photos
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({photos.length}/10)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {photosLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading photos…
              </div>
            ) : photos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No photos attached yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    className="aspect-square rounded-lg overflow-hidden border bg-muted"
                    onClick={() => setPreviewUrl(photo.photoUrl)}
                  >
                    <img
                      src={photo.photoUrl}
                      alt={photo.caption || `Work order photo ${photo.id}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
            {workOrder.status === "completed" && canAttachPhotos && (
              <div className="mt-3 space-y-2">
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={uploading || photos.length >= 10}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Add photo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {workOrder.description || "No description provided"}
            </p>
          </CardContent>
        </Card>

        {/* Asset Info */}
        {(workOrder as { assetName?: string }).assetName && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Asset</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{(workOrder as { assetName?: string }).assetName}</p>
              {(workOrder as { assetTag?: string }).assetTag && (
                <p className="text-sm text-muted-foreground">
                  Tag: {(workOrder as { assetTag?: string }).assetTag}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter work notes, findings, or updates..."
              rows={4}
              className="text-base"
            />
            <Button
              className="w-full"
              variant="outline"
              onClick={handleAddNotes}
              disabled={!notes.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Save Notes
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Existing Notes */}
        {workOrder.completionNotes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Previous Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{workOrder.completionNotes}</p>
            </CardContent>
          </Card>
        )}

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created:</span>
              <span>{new Date(workOrder.createdAt).toLocaleDateString()}</span>
            </div>
            {workOrder.scheduledEnd && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due:</span>
                <span>{new Date(workOrder.scheduledEnd).toLocaleDateString()}</span>
              </div>
            )}
            {workOrder.actualEnd && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed:</span>
                <span>{new Date(workOrder.actualEnd).toLocaleDateString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {previewUrl && (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            alt="Work order photo preview"
            className="max-h-full max-w-full object-contain"
          />
        </button>
      )}
    </div>
  );
}
