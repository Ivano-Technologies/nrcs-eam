import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Friendly photo error copy (IVA-176, Coco). Raw server errors never reach the user. */
export const PHOTO_UPLOAD_ERROR = "Couldn't upload photo. Try again, or contact your admin if it keeps happening.";
export const PHOTOS_LOAD_ERROR = "Couldn't load photos";

/** True when any part of the element is inside the viewport. A missing element counts as off-screen. */
export function isElementInViewport(el: Element | null | undefined): boolean {
  if (!el || typeof window === "undefined") return false;
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
}

export function PhotoUploadError({ onRetry, disabled }: { onRetry: () => void; disabled?: boolean }) {
  return (
    <div role="alert" data-testid="photo-upload-error" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle p-3 text-sm text-danger-foreground">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">{PHOTO_UPLOAD_ERROR}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={disabled}>
        <RotateCw className="mr-1 h-4 w-4" aria-hidden />
        Retry
      </Button>
    </div>
  );
}

export function PhotosLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" data-testid="photos-load-error" className="flex flex-col items-center gap-2 py-4 text-sm text-muted-foreground">
      <p>{PHOTOS_LOAD_ERROR}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        <RotateCw className="mr-1 h-4 w-4" aria-hidden />
        Retry
      </Button>
    </div>
  );
}
