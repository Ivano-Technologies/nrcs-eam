import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, ImagePlus, Loader2, Upload, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type FileUploadStatus = "pending" | "uploading" | "done" | "error";

type SelectedFile = {
  file: File;
  previewUrl: string;
  status: FileUploadStatus;
};

export type PhotoUploadZoneProps = {
  maxFiles?: number;
  maxFileSizeMb?: number;
  disabled?: boolean;
  onUpload: (files: File[], caption?: string) => Promise<void>;
  uploading?: boolean;
};

function validateFile(file: File, maxFileSizeMb: number): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return `${file.name}: only JPEG, PNG, and WebP are allowed`;
  }
  if (file.size > maxFileSizeMb * 1024 * 1024) {
    return `${file.name}: must be under ${maxFileSizeMb}MB`;
  }
  return null;
}

export default function PhotoUploadZone({
  maxFiles = 10,
  maxFileSizeMb = 5,
  disabled = false,
  onUpload,
  uploading = false,
}: PhotoUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<SelectedFile[]>([]);
  const [caption, setCaption] = useState("");
  const [internalUploading, setInternalUploading] = useState(false);

  const isBusy = disabled || uploading || internalUploading;
  const remainingSlots = maxFiles - selected.length;

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      if (incoming.length === 0) return;

      const allowed = Math.max(0, remainingSlots);
      if (allowed === 0) {
        toast.error(`Maximum ${maxFiles} file(s) can be selected`);
        return;
      }

      const toAdd: SelectedFile[] = [];
      for (const file of incoming.slice(0, allowed)) {
        const err = validateFile(file, maxFileSizeMb);
        if (err) {
          toast.error(err);
          continue;
        }
        toAdd.push({
          file,
          previewUrl: URL.createObjectURL(file),
          status: "pending",
        });
      }

      if (incoming.length > allowed) {
        toast.error(`Only ${allowed} more file(s) can be added`);
      }

      if (toAdd.length > 0) {
        setSelected((prev) => [...prev, ...toAdd]);
      }
    },
    [maxFileSizeMb, maxFiles, remainingSlots]
  );

  const removeFile = (index: number) => {
    setSelected((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const clearAll = () => {
    selected.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setSelected([]);
    setCaption("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (isBusy) return;
    addFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (selected.length === 0 || isBusy) return;

    setInternalUploading(true);
    const captionValue = caption.trim() || undefined;
    let successCount = 0;

    for (let i = 0; i < selected.length; i++) {
      const { file } = selected[i];
      setSelected((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: "uploading" as const } : s))
      );

      try {
        await onUpload([file], captionValue);
        successCount++;
        setSelected((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: "done" as const } : s))
        );
      } catch {
        toast.error(`Failed to upload ${file.name}`);
        setSelected((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: "error" as const } : s))
        );
      }
    }

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? "Photo uploaded successfully"
          : `${successCount} photo${successCount === 1 ? "" : "s"} uploaded successfully`
      );
    }

    setInternalUploading(false);

    setSelected((prev) => {
      const failed = prev.filter((s) => s.status === "error");
      prev
        .filter((s) => s.status === "done")
        .forEach((s) => URL.revokeObjectURL(s.previewUrl));
      if (failed.length === 0) {
        setCaption("");
        return [];
      }
      return failed.map((s) => ({ ...s, status: "pending" as const }));
    });
  };

  const statusIcon = (status: FileUploadStatus) => {
    if (status === "uploading") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    if (status === "done") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === "error") return <XCircle className="h-4 w-4 text-destructive" />;
    return null;
  };

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isBusy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isBusy && inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
          isBusy && "pointer-events-none opacity-60"
        )}
      >
        <ImagePlus className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Drag and drop photos here</p>
        <p className="text-xs text-muted-foreground">
          or click to browse · JPEG, PNG, WebP · max {maxFileSizeMb}MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          disabled={isBusy}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {selected.length > 0 && (
        <>
          <div className="space-y-2">
            <Label htmlFor="photo-caption">Caption (optional)</Label>
            <Input
              id="photo-caption"
              placeholder="e.g., Front entrance, Main hall"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={isBusy}
            />
            <p className="text-xs text-muted-foreground">
              Applied to all photos in this batch.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {selected.map((item, index) => (
              <div
                key={`${item.file.name}-${index}`}
                className="relative aspect-square rounded-lg overflow-hidden border bg-muted"
              >
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="w-full h-full object-cover"
                />
                {item.status !== "pending" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    {statusIcon(item.status)}
                  </div>
                )}
                {!isBusy && item.status === "pending" && (
                  <button
                    type="button"
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <p className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1 py-0.5 text-[10px] text-white">
                  {item.file.name}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleUpload} disabled={isBusy}>
              {isBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {selected.length} photo{selected.length === 1 ? "" : "s"}
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={clearAll} disabled={isBusy}>
              Clear
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
