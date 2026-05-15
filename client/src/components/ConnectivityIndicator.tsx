import { useConnectivity } from "@/hooks/useConnectivity";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const STATUS_LABEL: Record<ReturnType<typeof useConnectivity>["status"], string> = {
  online: "Online",
  offline: "Offline",
  syncing: "Syncing",
};

export function ConnectivityIndicator({ className }: { className?: string }) {
  const { status, pendingCount } = useConnectivity();

  const dotClass =
    status === "online"
      ? "bg-emerald-500"
      : status === "offline"
        ? "bg-amber-500"
        : "bg-amber-500 animate-pulse";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium",
        "border-border/60 bg-background/80 text-muted-foreground",
        className
      )}
      title={
        status === "offline" && pendingCount > 0
          ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync`
          : STATUS_LABEL[status]
      }
      data-testid="connectivity-indicator"
      data-status={status}
    >
      {status === "syncing" ? (
        <Loader2 className="h-3 w-3 animate-spin text-amber-600" aria-hidden />
      ) : (
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} aria-hidden />
      )}
      <span className="hidden sm:inline">{STATUS_LABEL[status]}</span>
      {pendingCount > 0 && status !== "syncing" ? (
        <span className="tabular-nums text-[10px] opacity-80">({pendingCount})</span>
      ) : null}
    </div>
  );
}
