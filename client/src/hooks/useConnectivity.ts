import { useCallback, useEffect, useState } from "react";
import { getOfflineQueueCount, subscribeOfflineQueue } from "@/lib/offlineSyncQueue";

export type ConnectivityStatus = "online" | "offline" | "syncing";

let globalFlush: (() => Promise<void>) | null = null;

export function registerOfflineFlush(fn: () => Promise<void>) {
  globalFlush = fn;
}

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(() => {
    setPendingCount(getOfflineQueueCount());
  }, []);

  const runFlush = useCallback(async () => {
    if (!globalFlush || !navigator.onLine || getOfflineQueueCount() === 0) return;
    setIsSyncing(true);
    try {
      await globalFlush();
    } finally {
      setIsSyncing(false);
      refreshPending();
    }
  }, [refreshPending]);

  useEffect(() => {
    refreshPending();
    return subscribeOfflineQueue(refreshPending);
  }, [refreshPending]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void runFlush();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [runFlush]);

  useEffect(() => {
    if (isOnline) {
      void runFlush();
    }
  }, [isOnline, runFlush]);

  const status: ConnectivityStatus = isSyncing ? "syncing" : isOnline ? "online" : "offline";

  return { isOnline, isSyncing, pendingCount, status };
}
