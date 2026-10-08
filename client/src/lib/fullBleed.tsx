/**
 * Full bleed views: a page (or one view of a page) opts in with `useFullBleed(true)` and the app
 * layout then shows the sidebar as the 64px icon rail while that view is showing.
 *
 * Rules (shared by every opted in view):
 * - Entering a full bleed view collapses the sidebar to the rail on desktop and tablet. Phones are
 *   unchanged (no persistent sidebar there).
 * - The collapse is a temporary override: the saved sidebar preference is never written by it, so
 *   leaving the view restores whatever the user had before.
 * - A manual expand (or collapse) while the view is showing is respected for the rest of that visit
 *   only; it does not overwrite the saved preference. Leaving still restores the prior saved state.
 * - The width change uses the sidebar's existing transition, which is off under reduced motion.
 *
 * Opted in: the Asset Map, the Facilities Map view, the wide WMS and report tables, and the print
 * previews. See FULL_BLEED_VIEWS. The Asset Scanner (built for phones) stays off. Anything else needs
 * sign off first.
 */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from "react";
import { SIDEBAR_RAIL_WIDTH } from "@/lib/sidebarWidth";

/** Views flagged full bleed. Keep this in sync with the `useFullBleed` calls. */
export const FULL_BLEED_VIEWS = [
  { id: "asset-map", path: "/app/asset-map", note: "Asset Map page" },
  { id: "facilities-map", path: "/app/facilities/*", note: "Facilities, only while the Map view is showing" },
  // Wide WMS and report tables (9 or more columns that scroll sideways at 1280).
  { id: "wms-monthly-report", path: "/app/reports/wms/monthly-warehouse-report", note: "Monthly warehouse report table (11 columns)" },
  { id: "wms-stock-movements", path: "/app/reports/wms/stock-movements", note: "WMS stock movements table (10 columns)" },
  { id: "wms-loss-damage", path: "/app/reports/wms/loss-damage", note: "WMS loss and damage table (9 columns)" },
  { id: "branch-scorecards", path: "/app/reports/branch-scorecards", note: "Branch scorecards, only while the Table view is showing (11 columns)" },
  // Print and form previews. These routes render outside the app layout today (no sidebar at all),
  // so the flag only takes effect if they are ever shown inside the layout.
  { id: "print-receipt", path: "/app/inventory/receipts/:id/print/:copyType", note: "GRN print preview" },
  { id: "print-waybill", path: "/app/inventory/issues/:id/print/:copyType", note: "Waybill print preview" },
  { id: "print-stock-card", path: "/app/inventory/tracking/stock-cards/:id/print", note: "Stock card print preview" },
  { id: "print-bin-card", path: "/app/inventory/tracking/bin-cards/:id/print", note: "Bin card print preview" },
  { id: "print-monthly-report", path: "/app/reports/wms/monthly-warehouse-report/print/:warehouseId/:year/:month", note: "Monthly report print preview" },
] as const;

type FullBleedRegistry = { register: (id: string) => void; unregister: (id: string) => void };

const FullBleedContext = createContext<FullBleedRegistry | null>(null);

/** Owned by the app layout: tracks which views currently ask for full bleed. */
export function useFullBleedRegistry(): { active: boolean; registry: FullBleedRegistry } {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  const register = useCallback((id: string) => {
    setIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);
  const unregister = useCallback((id: string) => {
    setIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);
  const registry = useMemo(() => ({ register, unregister }), [register, unregister]);
  return { active: ids.size > 0, registry };
}

export const FullBleedProvider = FullBleedContext.Provider;

/**
 * Opt the calling view into full bleed while `active` is true. Safe outside the app layout (no op).
 */
export function useFullBleed(active: boolean): void {
  const registry = useContext(FullBleedContext);
  const id = useId();
  useEffect(() => {
    if (!registry || !active) return;
    registry.register(id);
    return () => registry.unregister(id);
  }, [registry, active, id]);
}

/**
 * The sidebar width to render, plus the handler for a manual toggle or drag.
 *
 * - `saved` is the user's preference. The auto collapse never writes it.
 * - Inside a full bleed visit a manual toggle only sets a visit width (nothing is saved).
 * - Leaving a visit always restores `saved`, even after a manual expand during the visit.
 */
export function useAutoRail({
  saved,
  fullBleed,
  isMobile,
  onSaveWidth,
}: {
  saved: number;
  fullBleed: boolean;
  isMobile: boolean;
  onSaveWidth: (width: number) => void;
}): {
  width: number;
  autoRail: boolean;
  /** True while a full bleed visit is open on desktop or tablet (manual toggles are visit only). */
  inVisit: boolean;
  onManualWidth: (width: number) => void;
} {
  const inVisit = fullBleed && !isMobile;
  const [visitWidth, setVisitWidth] = useState<number | null>(null);
  const [wasInVisit, setWasInVisit] = useState(inVisit);
  if (inVisit !== wasInVisit) {
    setWasInVisit(inVisit);
    // Leaving (or entering) clears any visit override so display falls back to saved / rail.
    setVisitWidth(null);
  }

  const autoRail = inVisit && visitWidth == null;
  const width = inVisit ? (visitWidth ?? SIDEBAR_RAIL_WIDTH) : saved;
  const onManualWidth = useCallback(
    (next: number) => {
      if (inVisit) setVisitWidth(next);
      else onSaveWidth(next);
    },
    [inVisit, onSaveWidth]
  );
  return { width, autoRail, inVisit, onManualWidth };
}
