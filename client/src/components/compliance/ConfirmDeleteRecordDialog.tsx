import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Confirm before deleting a compliance register record (IVA-173, Coco's pattern).
 * Cancel has default focus; Escape and an outside click cancel. While deleting both buttons are disabled
 * and the dialog cannot be dismissed. The caller closes it on success and keeps it open on error.
 * Below sm the buttons stack full width with Delete at the bottom.
 */
export function ConfirmDeleteRecordDialog({
  open,
  title,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancel = () => {
    if (!pending) onCancel();
  };
  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? null : cancel())}>
      <AlertDialogPortal>
        <AlertDialogOverlay data-testid="confirm-delete-overlay" onClick={cancel} />
        <AlertDialogPrimitive.Content
          data-slot="alert-dialog-content"
          data-testid="confirm-delete-dialog"
          className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border p-6 shadow-lg duration-200 sm:max-w-lg"
          onEscapeKeyDown={(e) => {
            if (pending) e.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>This removes the record for everyone. You can't undo this.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row">
            <AlertDialogCancel className="w-full sm:w-auto" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              data-testid="confirm-delete-record"
              className="bg-danger w-full text-white hover:bg-danger/90 sm:w-auto"
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Delete record
            </Button>
          </AlertDialogFooter>
        </AlertDialogPrimitive.Content>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
