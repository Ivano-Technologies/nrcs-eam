import { useCallback, useEffect, useState } from "react";
import type { ViewMode } from "@/components/ViewToggle";
import { useIsMobile } from "@/hooks/useMobile";

/**
 * Saved Card or Table choice per list page.
 *
 * - Card is the default wherever a Card/Table toggle exists, desktop too. Dense lists (Assets, Stock
 *   overview) pass `"table"` as their default.
 * - Phones always open in Card until the user toggles.
 * - The choice is saved only when the user toggles, never on page load.
 * - One time reset (polish round, Oct 2026): choices now live under `viewMode_v2_<name>`. The old
 *   `viewMode_<name>` keys were written on every page load, so a real choice cannot be told apart
 *   from an automatic write; they are ignored and removed.
 */
export const VIEW_MODE_STORAGE_PREFIX = "viewMode_v2_";
const LEGACY_VIEW_MODE_PREFIX = "viewMode_";

export function viewModeStorageKey(name: string): string {
  return `${VIEW_MODE_STORAGE_PREFIX}${name}`;
}

/** The saved choice, or null when the user never toggled on this page (since the reset). */
export function readSavedViewMode<M extends string = ViewMode>(name: string, allowed: readonly M[] = ["card", "table"] as unknown as M[]): M | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(viewModeStorageKey(name));
    return raw && (allowed as readonly string[]).includes(raw) ? (raw as M) : null;
  } catch {
    return null;
  }
}

export function saveViewMode(name: string, mode: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(viewModeStorageKey(name), mode);
  } catch {
    /* storage full or blocked: the choice still applies for this visit */
  }
}

/** Removes the pre reset key for this page (once per page; cheap and idempotent). */
export function useDropLegacyViewMode(name: string): void {
  useEffect(() => {
    try {
      window.localStorage.removeItem(`${LEGACY_VIEW_MODE_PREFIX}${name}`);
    } catch {
      /* ignore */
    }
  }, [name]);
}

export function useViewMode(name: string, defaultMode: ViewMode = "card"): [ViewMode, (mode: ViewMode) => void] {
  const isMobile = useIsMobile();
  const [saved, setSaved] = useState<ViewMode | null>(() => readSavedViewMode(name));
  const [override, setOverride] = useState<ViewMode | null>(null);
  useDropLegacyViewMode(name);

  const viewMode: ViewMode = override ?? (isMobile ? "card" : (saved ?? defaultMode));

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setOverride(mode);
      setSaved(mode);
      saveViewMode(name, mode);
    },
    [name]
  );

  return [viewMode, setViewMode];
}
