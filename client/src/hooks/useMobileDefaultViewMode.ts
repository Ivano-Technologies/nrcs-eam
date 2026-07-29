import { useEffect, useState } from "react";
import type { ViewMode } from "@/components/ViewToggle";
import { useIsMobile } from "@/hooks/useMobile";

/**
 * Persists table/card preference, but on mobile defaults to "card"
 * regardless of the saved localStorage value until the user toggles.
 */
export function useMobileDefaultViewMode(
  storageKey: string
): [ViewMode, (mode: ViewMode) => void] {
  const isMobile = useIsMobile();
  const [stored, setStored] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "table";
    return window.localStorage.getItem(storageKey) === "card" ? "card" : "table";
  });
  const [override, setOverride] = useState<ViewMode | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, stored);
  }, [storageKey, stored]);

  const viewMode: ViewMode = override ?? (isMobile ? "card" : stored);

  const setViewMode = (mode: ViewMode) => {
    setOverride(mode);
    setStored(mode === "card" || mode === "table" ? mode : "table");
  };

  return [viewMode, setViewMode];
}
