import { registerOfflineFlush } from "@/hooks/useConnectivity";
import { peekGrnOperations, replaceGrnQueue } from "@/lib/offlineSyncQueue";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { toast } from "sonner";

/** Registers GRN offline-queue flush handlers (must render inside trpc.Provider). */
export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils();
  const createDraft = trpc.inventoryV2.receipts.createDraft.useMutation();
  const updateDraft = trpc.inventoryV2.receipts.updateDraft.useMutation();

  useEffect(() => {
    registerOfflineFlush(async () => {
      const pending = peekGrnOperations();
      if (pending.length === 0) return;

      const remaining = [];
      let synced = 0;

      for (const item of pending) {
        try {
          if (item.kind === "createDraft") {
            await createDraft.mutateAsync(item.payload as never);
          } else {
            await updateDraft.mutateAsync({
              documentId: item.documentId,
              payload: item.payload as never,
            });
          }
          synced += 1;
        } catch {
          remaining.push(item);
        }
      }

      replaceGrnQueue(remaining);

      if (synced > 0) {
        toast.success(
          `Synced ${synced} offline GRN change${synced === 1 ? "" : "s"}`
        );
        void utils.invalidate();
      }
      if (remaining.length > 0) {
        toast.error(
          `${remaining.length} offline change${remaining.length === 1 ? "" : "s"} could not sync — open the GRN and save again`
        );
      }
    });
  }, [createDraft, updateDraft, utils]);

  return <>{children}</>;
}
