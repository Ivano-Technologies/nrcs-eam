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
 * - The fold is decided before the first paint of the new view: routes that are always full bleed
 *   are matched from the URL in the layout (`routeWantsFullBleed`), and view level opt ins register
 *   in a layout effect, so a page never paints at the old width first.
 * - The width change is a 200ms ease slide (the sidebar gap and container transitions). Under
 *   prefers-reduced-motion it is instant (global rule in index.css).
 *
 * Opted in (Kezie, 9 Oct 2026): the Asset Map, the Facilities Map view, and the four wide report
 * tables. Every other page opens with the full sidebar. See FULL_BLEED_VIEWS. The Asset Scanner
 * (built for phones) stays off, and the print previews render outside the layout (no sidebar), so
 * they need no flag. Anything else needs sign off first.
 */
import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useState } from "react";
import { SIDEBAR_RAIL_WIDTH } from "@/lib/sidebarWidth";
import { FACILITIES_VIEW_NAME, FACILITIES_VIEWS, isFacilitiesListPath } from "@/lib/facilityRoutes";
import { readSavedViewMode } from "@/hooks/useViewMode";

/** Views flagged full bleed. Keep this in sync with the `useFullBleed` calls. */
export const FULL_BLEED_VIEWS = [
  { id: "asset-map", path: "/app/asset-map", note: "Asset Map page" },
  { id: "facilities-map", path: "/app/facilities/*?view=map", note: "Facilities list, Map view (?view=map, or a saved Map choice)" },
  // Wide WMS and report tables (9 or more columns that scroll sideways at 1280).
  { id: "wms-monthly-report", path: "/app/reports/wms/monthly-warehouse-report", note: "Monthly warehouse report table (11 columns)" },
  { id: "wms-stock-movements", path: "/app/reports/wms/stock-movements", note: "WMS stock movements table (10 columns)" },
  { id: "wms-loss-damage", path: "/app/reports/wms/loss-damage", note: "WMS loss and damage table (9 columns)" },
  { id: "branch-scorecards", path: "/app/reports/branch-scorecards", note: "Branch scorecards, only while the Table view is showing (11 columns)" },
] as const;

/**
 * Routes that are full bleed on every visit, matched from the URL in the layout so the fold starts
 * in the same render as the navigation (no frame at the old width, no wait for the page chunk).
 * View level cases (Facilities Map view, Branch scorecards Table view) still use `useFullBleed`.
 */
export const ROUTE_FULL_BLEED_PATHS: readonly string[] = [
  "/app/asset-map",
  "/app/reports/wms/monthly-warehouse-report",
  "/app/reports/wms/stock-movements",
  "/app/reports/wms/loss-damage",
];

/**
 * True when the route alone asks for the icon rail. `pathname` may carry a trailing slash; `search`
 * is the query string with or without the leading "?".
 * The Facilities list folds for `?view=map`, and also for a saved Map choice while the page adds
 * `?view=map` to the URL (so the first frame is already folded).
 */
export function routeWantsFullBleed(pathname: string, search = ""): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (ROUTE_FULL_BLEED_PATHS.includes(path)) return true;
  if (isFacilitiesListPath(path)) {
    const view = new URLSearchParams(search).get("view");
    if (view === "map") return true;
    return view == null && readSavedViewMode(FACILITIES_VIEW_NAME, FACILITIES_VIEWS) === "map";
  }
  return false;
}

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
  // Layout effect: the registry update re-renders the layout before the browser paints, so the
  // view never shows a frame at the full width before folding.
  useLayoutEffect(() => {
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
