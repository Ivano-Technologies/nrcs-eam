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
import { trpc } from "@/lib/trpc";
import { FACILITY_DELETE_FAILED_MESSAGE } from "@shared/facilityDelete";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type DeleteError = { message: string; blocked: boolean };

/**
 * IVA-181: single facility delete. A blocked delete (assets or child facilities still linked) turns the dialog
 * into a notice: "You can't delete this facility yet", the reason, and a single Close (Coco). A failure keeps
 * the delete dialog open with a generic message and Try again, the same pattern as the compliance register (IVA-173).
 * Raw server errors never reach the user.
 */
export function FacilityDeleteDialog({
  facility,
  onClose,
  onDeleted,
}: {
  facility: { id: number; name: string } | null;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}) {
  const [error, setError] = useState<DeleteError | null>(null);
  const inFlight = useRef(false);
  const remove = trpc.sites.bulkDelete.useMutation();

  useEffect(() => {
    setError(null);
  }, [facility?.id]);

  const pending = remove.isPending;
  const blocked = error?.blocked === true;

  const confirm = async () => {
    if (!facility || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const res = await remove.mutateAsync({ ids: [facility.id] });
      if (res.deleted > 0) {
        toast.success("Facility deleted");
        await onDeleted();
        return;
      }
      const failure = res.failures?.[0];
      setError({
        message: failure?.message ?? FACILITY_DELETE_FAILED_MESSAGE,
        blocked: failure?.reason === "has_assets" || failure?.reason === "has_children",
      });
    } catch (e) {
      console.error("Facility delete failed:", e);
      setError({ message: FACILITY_DELETE_FAILED_MESSAGE, blocked: false });
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <AlertDialog
      open={facility !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogContent data-testid="facility-delete-dialog">
        {blocked ? (
          // Coco (#150): a blocked delete is not an error. Say why in normal text and offer Close only;
          // no undo warning and no red Delete. The reason wording waits on Kezie.
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>You can't delete this facility yet</AlertDialogTitle>
              <AlertDialogDescription data-testid="facility-delete-blocked-reason" aria-live="polite">
                {error?.message}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="facility-delete-close">Close</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete facility</AlertDialogTitle>
              <AlertDialogDescription>Delete {facility?.name}? This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            {error ? (
              <p role="alert" data-testid="facility-delete-error" className="text-sm font-medium text-danger dark:text-primary-on-dark">
                {error.message}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                data-testid="facility-delete-confirm"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={pending}
                onClick={(e) => {
                  e.preventDefault();
                  void confirm();
                }}
              >
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Deleting…
                  </>
                ) : error ? (
                  "Try again"
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
