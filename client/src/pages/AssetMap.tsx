/**
 * Asset Map: where each facility is, how ready its stock is, and where its assets are.
 *
 * One map for the page visit (MapView keeps it alive across layer, filter and theme changes).
 * Pins and bubbles are AdvancedMarkerElements managed by AssetMapOverlay. Selecting a pin or a
 * list row opens the drawer and at most pans the map; it never changes zoom.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ListFilter, List as ListIcon, Search, X } from "lucide-react";
import type { FacilityType } from "@shared/facilities";
import { MapView, type MapColorScheme } from "@/components/Map";
import { FacilityPanel } from "@/components/assetMap/FacilityPanel";
import { FacilityDrawer } from "@/components/assetMap/FacilityDrawer";
import { EmptyMapCard, LayerBar, MapControls, MapErrorCard, NoLocationChip, TileShimmer } from "@/components/assetMap/MapChrome";
import { MockMapCanvas } from "@/components/assetMap/MockMapCanvas";
import { BottomSheet, snapHeight, type SheetSnap } from "@/components/assetMap/BottomSheet";
import { focusRing, mutedText, surfaceClass, useMapScheme, useMediaQuery } from "@/components/assetMap/parts";
import { createGoogleController, type MapController, type MapStyle } from "@/lib/assetMap/controller";
import { AssetMapOverlay } from "@/lib/assetMap/googleOverlay";
import {
  EMPTY_FILTERS,
  buildMapSearch,
  countByTier,
  countByType,
  countNoLocation,
  facilityPosition,
  facilityUrlKey,
  filterFacilities,
  filterSummary,
  findByUrlKey,
  formatClock,
  hasActiveFilters,
  matchesFilters,
  parseMapSearch,
  sortFacilities,
  type ListSort,
  type MapFacility,
  type MapFilters,
  type MapLayer,
} from "@/lib/assetMap/model";
import { useMapSelection, type Insets } from "@/lib/assetMap/useMapSelection";
import type { ReadinessTier } from "@/lib/facilityMapHelpers";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM_COUNTRY } from "@/lib/mapDefaults";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const PANEL_W = 360;
const DRAWER_W = 368;
const TABLET_DRAWER_W = 360;
const RAIL_W = 56;
const GAP = 16;
/** Leaves Google's logo and attribution visible below floating panels. */
const BOTTOM_INSET = 40;

/** Applied once per map instance. Keeps the view on Nigeria and its neighbours. */
const MAP_OPTIONS: google.maps.MapOptions = {
  minZoom: 5,
  clickableIcons: false,
  keyboardShortcuts: true,
  restriction: {
    // Generous so the map can pan a pin above a mobile sheet; still Nigeria and its neighbours.
    latLngBounds: { north: 26, south: -20, west: -16, east: 32 },
    strictBounds: false,
  },
};

/** Phones: the strip above the list sheet is short, so allow one more zoom level out to fit Nigeria. */
const MOBILE_MAP_OPTIONS: google.maps.MapOptions = {
  ...MAP_OPTIONS,
  minZoom: 4,
  // At zoom 4 a tall phone viewport spans about 60 degrees of latitude, and the sheet pushes the
  // fitted centre well south, so the restriction has to be looser than on desktop.
  restriction: { latLngBounds: { north: 45, south: -50, west: -35, east: 50 }, strictBounds: false },
};

const SHIMMER_CSS = `
.nrcs-map-shimmer{background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.06) 50%,transparent 70%);background-size:200% 100%;animation:nrcs-map-sweep 1.2s linear infinite}
.dark .nrcs-map-shimmer{background-image:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.04) 50%,transparent 70%)}
@keyframes nrcs-map-sweep{from{background-position:200% 0}to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.nrcs-map-shimmer{animation:none;background:rgba(255,255,255,.06)}.dark .nrcs-map-shimmer{background:rgba(255,255,255,.04)}}
`;

function readInitialUrl() {
  if (typeof window === "undefined") return parseMapSearch("");
  return parseMapSearch(window.location.search);
}

/** Element height, plus whether it has held still for 250ms (layout settles after mount). */
function useElementHeight(ref: React.RefObject<HTMLElement | null>): { height: number; stable: boolean } {
  const [h, setH] = useState(0);
  const [stable, setStable] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    const update = () => {
      setH(el.clientHeight);
      setStable(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setStable(true), 250);
    };
    update();
    if (typeof ResizeObserver === "undefined") return () => window.clearTimeout(timer);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, [ref]);
  return { height: h, stable };
}

export default function AssetMap() {
  const [initial] = useState(readInitialUrl);
  const mapMock = initial.mapMock;
  const scheme = useMapScheme();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isMobile = !useMediaQuery("(min-width: 640px)");
  const isTablet = !isDesktop && !isMobile;
  const touch = useMediaQuery("(pointer: coarse)");

  /* ---------------- data ---------------- */
  const mapQuery = trpc.sites.mapFacilities.useQuery(undefined, {
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const all: MapFacility[] = useMemo(() => mapQuery.data?.facilities ?? [], [mapQuery.data]);
  const statsLimited = mapQuery.data ? mapQuery.data.statsScope !== "all" : false;
  const freshness = formatClock(mapQuery.data?.generatedAt);

  /* ---------------- view state ---------------- */
  const [layer, setLayer] = useState<MapLayer>(initial.layer);
  const [lines, setLines] = useState(initial.lines);
  const [filters, setFilters] = useState<MapFilters>(initial.filters);
  const [searchText, setSearchText] = useState(initial.filters.q);
  const [sortByLayer, setSortByLayer] = useState<Record<MapLayer, ListSort>>({ facilities: "readiness", assets: "assets" });
  const sort = sortByLayer[layer];
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("default");
  const [mapError, setMapError] = useState<string | null>(null);
  const [tilesLoading, setTilesLoading] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [listSnap, setListSnap] = useState<SheetSnap>("half");
  const [detailSnap, setDetailSnap] = useState<SheetSnap>("half");

  // Debounced search (200ms). Search filters the list and pins; it never pans or zooms.
  useEffect(() => {
    if (searchText === filters.q) return;
    const t = window.setTimeout(() => setFilters((f) => ({ ...f, q: searchText })), 200);
    return () => window.clearTimeout(t);
  }, [searchText, filters.q]);

  const filtered = useMemo(() => filterFacilities(all, filters), [all, filters]);
  const visibleIds = useMemo(() => new Set(filtered.map((f) => f.id)), [filtered]);
  const tierCounts = useMemo(() => countByTier(all, filters), [all, filters]);
  const typeCounts = useMemo(() => countByType(all, filters), [all, filters]);
  const noLocationCount = useMemo(() => countNoLocation(all), [all]);
  const activeFilters = hasActiveFilters(filters);
  const onMapCount = filtered.filter((f) => facilityPosition(f)).length;
  const isEmpty = !mapQuery.isLoading && all.length > 0 && activeFilters && onMapCount === 0 && !filters.noLocationOnly;
  const byId = useMemo(() => new Map(all.map((f) => [f.id, f])), [all]);

  /* ---------------- geometry ---------------- */
  const frameRef = useRef<HTMLDivElement>(null);
  const { height: frameHeight, stable: frameStable } = useElementHeight(frameRef);
  const drawerRef = useRef<HTMLDivElement>(null);

  const insetsFor = useCallback(
    (drawerOpen: boolean): Insets => {
      if (isMobile) {
        const sheet = drawerOpen
          ? snapHeight(detailSnap, frameHeight, Math.min(500, frameHeight - 80))
          : snapHeight(listSnap, frameHeight);
        return { top: 16 + 52 + (noLocationCount > 0 ? 48 : 0), right: 16, bottom: sheet, left: 16 };
      }
      const left = isDesktop ? GAP + PANEL_W + GAP : GAP + RAIL_W + GAP;
      const right = drawerOpen ? GAP + (isDesktop ? DRAWER_W : TABLET_DRAWER_W) + GAP : GAP + 48;
      return { top: 72, right, bottom: BOTTOM_INSET, left };
    },
    [isMobile, isDesktop, frameHeight, detailSnap, listSnap, noLocationCount]
  );

  /** Fitting may let the notice chip overlap the far north on phones, as in the mockup. */
  const fitInsetsFor = useCallback(
    (drawerOpen: boolean): Insets => {
      const base = insetsFor(drawerOpen);
      return isMobile ? { ...base, top: 16 + 54 } : base;
    },
    [insetsFor, isMobile]
  );

  /* ---------------- map plumbing ---------------- */
  const controllerRef = useRef<MapController | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapEpoch, setMapEpoch] = useState(0);
  const fittedRef = useRef(false);
  const mockRef = useRef<MapController | null>(null);

  const byIdRef = useRef(byId);
  const insetsRef = useRef(insetsFor);
  useLayoutEffect(() => {
    byIdRef.current = byId;
    insetsRef.current = insetsFor;
  });
  const ensureVisible = useCallback((id: number) => {
    const f = byIdRef.current.get(id);
    const pos = f ? facilityPosition(f) : null;
    if (!pos) return;
    // Wait a frame so the drawer insets are current; this only ever pans.
    window.requestAnimationFrame(() => controllerRef.current?.ensureVisible(pos, insetsRef.current(true)));
  }, []);
  const { selectedId, select, clear } = useMapSelection({ ensureVisible });
  const selected = selectedId != null ? byId.get(selectedId) : undefined;

  const detailQuery = trpc.sites.mapFacilityDetail.useQuery(
    { id: selectedId ?? 0 },
    { enabled: selectedId != null, staleTime: 5 * 60_000, refetchOnWindowFocus: false }
  );

  const selectedIdRef = useRef(selectedId);
  useLayoutEffect(() => {
    selectedIdRef.current = selectedId;
  });
  // Stable callbacks shared by the Google overlay and the mock canvas (select and clear are stable).
  const [callbacks] = useState(() => ({
    onSelect: (id: number, opener: HTMLElement | null) => select(id, opener),
    onHover: (id: number | null) => setHoveredId(id),
    onBackgroundClick: () => {
      if (selectedIdRef.current != null) clear({ restoreFocus: false });
    },
  }));

  const [overlay] = useState(() => (mapMock ? null : new AssetMapOverlay(callbacks)));
  useEffect(() => () => overlay?.destroy(), [overlay]);

  const shimmerTimer = useRef<number | null>(null);
  const startShimmer = useCallback(() => {
    setTilesLoading(true);
    if (shimmerTimer.current) window.clearTimeout(shimmerTimer.current);
    shimmerTimer.current = window.setTimeout(() => setTilesLoading(false), 8000);
  }, []);
  const stopShimmer = useCallback(() => {
    if (shimmerTimer.current) window.clearTimeout(shimmerTimer.current);
    shimmerTimer.current = null;
    setTilesLoading(false);
  }, []);
  useEffect(() => () => {
    if (shimmerTimer.current) window.clearTimeout(shimmerTimer.current);
  }, []);

  const mapListeners = useRef<google.maps.MapsEventListener[]>([]);
  const onMapReady = useCallback(
    (map: google.maps.Map) => {
      mapListeners.current.forEach((l) => l.remove());
      mapRef.current = map;
      controllerRef.current = createGoogleController(map);
      overlay?.setMap(map);
      mapListeners.current = [
        map.addListener("zoom_changed", startShimmer),
        map.addListener("maptypeid_changed", startShimmer),
      ];
      setMapEpoch((n) => n + 1);
    },
    [startShimmer, overlay]
  );

  useEffect(() => {
    if (mapMock) controllerRef.current = mockRef.current;
  });

  // Read only QA hook: current zoom, so smoke tests can check selection never zooms.
  useEffect(() => {
    const w = window as Window & { __assetMapZoom?: () => number | undefined };
    w.__assetMapZoom = () => controllerRef.current?.getZoom();
    return () => {
      delete w.__assetMapZoom;
    };
  }, []);

  // Keep the overlay in sync. Updates markers in place; never refits.
  useEffect(() => {
    if (!overlay) return;
    overlay.update({
      facilities: all,
      visibleIds,
      layer,
      scheme,
      selectedId,
      hoveredId,
      lines,
      empty: isEmpty,
      touch,
    });
  }, [overlay, all, visibleIds, layer, scheme, selectedId, hoveredId, lines, isEmpty, touch, mapEpoch]);

  // First load: fit all located facilities once, with panel padding.
  useEffect(() => {
    if (fittedRef.current || !mapQuery.data || !frameStable) return;
    if (!mapMock && !mapRef.current) return;
    const points = filtered.map(facilityPosition).filter((p): p is google.maps.LatLngLiteral => Boolean(p));
    const fallback = all.map(facilityPosition).filter((p): p is google.maps.LatLngLiteral => Boolean(p));
    fittedRef.current = true;
    const target = points.length ? points : fallback;
    if (target.length) controllerRef.current?.fitTo(target, fitInsetsFor(selectedIdRef.current != null));
  }, [mapQuery.data, mapEpoch, mapMock, filtered, all, fitInsetsFor, frameStable]);

  // Restore ?facility= once data arrives.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !mapQuery.data) return;
    restoredRef.current = true;
    const f = findByUrlKey(all, initial.facility);
    if (f) select(f.id, null);
  }, [mapQuery.data, all, initial.facility, select]);

  // URL sync (replaceState, so it doesn't spam history).
  useEffect(() => {
    if (!restoredRef.current && initial.facility) return;
    const search = buildMapSearch({
      layer,
      lines,
      filters,
      facility: selected ? facilityUrlKey(selected) : null,
      mapMock,
    });
    const url = `${window.location.pathname}${search}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [layer, lines, filters, selected, mapMock, initial.facility, mapQuery.data]);

  // Esc closes the drawer and returns focus to the opener.
  useEffect(() => {
    if (selectedId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const target = e.target;
      if (target instanceof Element && target.closest("[role='menu'],[data-radix-popper-content-wrapper]")) return;
      clear({ restoreFocus: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, clear]);

  /* ---------------- actions ---------------- */
  const toggleTier = (tier: ReadinessTier) =>
    setFilters((f) => ({ ...f, tiers: f.tiers.includes(tier) ? f.tiers.filter((t) => t !== tier) : [...f.tiers, tier] }));
  const toggleType = (type: FacilityType) =>
    setFilters((f) => ({ ...f, types: f.types.includes(type) ? f.types.filter((t) => t !== type) : [...f.types, type] }));
  const toggleOffline = () => setFilters((f) => ({ ...f, offlineOnly: !f.offlineOnly }));
  const toggleNoLocation = () => {
    setFilters((f) => ({ ...f, noLocationOnly: !f.noLocationOnly }));
    if (isMobile) setListSnap("half");
    if (isTablet) setRailOpen(true);
  };
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchText("");
  };
  const onSearchEnter = () => {
    const now = { ...filters, q: searchText };
    const first = sortFacilities(all.filter((f) => matchesFilters(f, now)), sort)[0];
    setFilters(now);
    if (first) select(first.id, null);
  };
  const fitAll = () => {
    const pts = (filtered.length ? filtered : all).map(facilityPosition).filter((p): p is google.maps.LatLngLiteral => Boolean(p));
    if (pts.length) controllerRef.current?.fitTo(pts, fitInsetsFor(selectedId != null));
  };
  const changeStyle = (style: MapStyle) => {
    setMapStyle(style);
    controllerRef.current?.setStyle(style);
  };
  const selectFromList = (id: number, opener: HTMLElement | null) => {
    select(id, opener);
    if (isTablet) setRailOpen(false);
    if (isMobile) setDetailSnap("half");
  };

  // Move focus into the drawer when it opens from the list or a pin.
  useEffect(() => {
    if (selectedId != null) drawerRef.current?.focus({ preventScroll: true });
  }, [selectedId]);

  /* ---------------- render ---------------- */
  const colorScheme: MapColorScheme = scheme === "dark" ? "DARK" : "LIGHT";
  const drawerOpen = Boolean(selected);
  const panelProps = {
    layer,
    scheme,
    loading: mapQuery.isLoading,
    all,
    filtered,
    tierCounts,
    typeCounts,
    filters,
    searchText,
    onSearchText: setSearchText,
    onSearchEnter,
    onToggleTier: toggleTier,
    onToggleType: toggleType,
    onToggleOffline: toggleOffline,
    onToggleNoLocation: toggleNoLocation,
    onClearFilters: clearFilters,
    sort,
    onSort: (s: ListSort) => setSortByLayer((prev) => ({ ...prev, [layer]: s })),
    selectedId,
    onSelect: selectFromList,
    statsLimited,
  };

  const drawer = selected ? (
    <FacilityDrawer
      ref={drawerRef}
      facility={selected}
      detail={detailQuery.data}
      detailLoading={detailQuery.isLoading}
      scheme={scheme}
      onClose={() => clear({ restoreFocus: true })}
      onSelectFacility={(id) => select(id, null)}
      variant={isMobile ? "sheet" : "drawer"}
      className="h-full"
    />
  ) : null;

  const controlsRight = drawerOpen && !isMobile ? GAP + (isDesktop ? DRAWER_W : TABLET_DRAWER_W) + GAP : GAP;

  return (
    <div className="-mx-3 -mt-3 flex h-[calc(100dvh-136px)] min-h-[480px] flex-col gap-3 sm:mx-0 sm:mt-0 sm:h-[calc(100dvh-152px)] sm:min-h-[520px] md:h-[calc(100dvh-88px)]">
      <style>{SHIMMER_CSS}</style>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 max-sm:sr-only">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-8 tracking-tight">Asset Map</h1>
          <p className={cn("text-sm", mutedText)}>Where each facility is, how ready its stock is, and where its assets are.</p>
        </div>
        {freshness ? (
          <p className={cn("text-xs tabular-nums", mutedText)} data-testid="asset-map-freshness">
            Stock data as of {freshness}
          </p>
        ) : null}
      </header>

      <div
        ref={frameRef}
        data-testid="asset-map-panel"
        className="relative min-h-0 flex-1 overflow-hidden border-b border-[#E5E7EB] bg-[#ECEEF1] dark:border-[#26364A] dark:bg-[#121B28] sm:rounded-2xl sm:border"
      >
        {/* Map layer */}
        {mapError ? (
          <div data-testid="asset-map-facility-fallback" className="absolute inset-0 bg-[#F3F4F6] dark:bg-[#0F1724]">
            <div
              className="absolute flex justify-center"
              style={isMobile ? { left: GAP, right: GAP, top: 128 } : { left: insetsFor(false).left, right: GAP, top: 132 }}
            >
              <MapErrorCard message={mapError} />
            </div>
          </div>
        ) : mapMock ? (
          <MockMapCanvas
            ref={mockRef}
            facilities={all}
            visibleIds={visibleIds}
            layer={layer}
            scheme={scheme}
            selectedId={selectedId}
            hoveredId={hoveredId}
            lines={lines}
            empty={isEmpty}
            insets={insetsFor(false)}
            onSelect={callbacks.onSelect}
            onHover={callbacks.onHover}
            onBackgroundClick={callbacks.onBackgroundClick}
          />
        ) : (
          <MapView
            className="absolute inset-0 h-full min-h-0 bg-transparent"
            initialCenter={{ ...DEFAULT_MAP_CENTER }}
            initialZoom={DEFAULT_MAP_ZOOM_COUNTRY}
            colorScheme={colorScheme}
            gestureHandling="greedy"
            disableDefaultUI
            options={isMobile ? MOBILE_MAP_OPTIONS : MAP_OPTIONS}
            onMapReady={onMapReady}
            onLoadError={setMapError}
            onTilesLoaded={stopShimmer}
            errorDisplay="none"
          />
        )}

        {!mapError ? <TileShimmer active={tilesLoading} /> : null}

        {/* Empty state: 35% scrim plus a card in the free area */}
        {isEmpty && !mapError ? (
          <>
            <div className="pointer-events-none absolute inset-0 z-[2] bg-[#FAFAF7]/35 dark:bg-[#0F1724]/35" aria-hidden="true" />
            <div
              className="pointer-events-none absolute z-[5] flex items-center justify-center"
              style={{
                left: insetsFor(drawerOpen).left,
                right: insetsFor(drawerOpen).right,
                top: insetsFor(drawerOpen).top,
                bottom: insetsFor(drawerOpen).bottom,
              }}
            >
              <EmptyMapCard summary={filterSummary(filters)} onClear={clearFilters} />
            </div>
          </>
        ) : null}

        {/* Desktop panel */}
        {isDesktop ? (
          <FacilityPanel
            {...panelProps}
            className={cn(surfaceClass, "absolute z-10 overflow-hidden")}
            style={{ left: GAP, top: GAP, bottom: BOTTOM_INSET, width: PANEL_W }}
          />
        ) : null}

        {/* Tablet rail */}
        {isTablet ? (
          <>
            <div
              className={cn(surfaceClass, "absolute z-10 flex flex-col items-center gap-1 py-2")}
              style={{ left: GAP, top: GAP, width: RAIL_W }}
            >
              <RailButton label="Search facilities" onClick={() => setRailOpen(true)}>
                <Search className="h-4 w-4" />
              </RailButton>
              <RailButton label="Filters" onClick={() => setRailOpen(true)} badge={filters.tiers.length + filters.types.length || undefined}>
                <ListFilter className="h-4 w-4" />
              </RailButton>
              <RailButton label="Facility list" onClick={() => setRailOpen(true)}>
                <ListIcon className="h-4 w-4" />
              </RailButton>
            </div>
            {railOpen ? (
              <div
                className={cn(surfaceClass, "absolute z-30 flex flex-col overflow-hidden")}
                style={{ left: GAP, top: GAP, bottom: BOTTOM_INSET, width: PANEL_W }}
              >
                <div className="flex items-center justify-end px-2 pt-2">
                  <button
                    type="button"
                    aria-label="Close facility list"
                    onClick={() => setRailOpen(false)}
                    className={cn("grid h-9 w-9 place-items-center rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#1E2B3C]", focusRing)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <FacilityPanel {...panelProps} className="min-h-0 flex-1" />
              </div>
            ) : null}
          </>
        ) : null}

        {/* Layer bar and notice chip */}
        <div
          className="pointer-events-none absolute z-10 flex flex-col items-start gap-2"
          style={
            isMobile
              ? { left: GAP, right: GAP, top: GAP }
              : { left: isDesktop ? GAP + PANEL_W + GAP : GAP + RAIL_W + GAP, top: GAP }
          }
        >
          <LayerBar
            layer={layer}
            onLayer={setLayer}
            lines={lines}
            onLines={setLines}
            compact={isMobile}
            className={cn("pointer-events-auto", isMobile && "w-full")}
          />
          <NoLocationChip
            count={noLocationCount}
            active={filters.noLocationOnly}
            onShow={toggleNoLocation}
            className="pointer-events-auto"
          />
        </div>

        {/* Map controls */}
        {!mapError && !(isMobile && drawerOpen) ? (
          <MapControls
            touch={touch}
            onZoomIn={() => controllerRef.current?.zoomBy(1)}
            onZoomOut={() => controllerRef.current?.zoomBy(-1)}
            onFit={fitAll}
            style={mapStyle}
            onStyle={changeStyle}
            fullscreenTarget={frameRef}
            className="absolute z-10 transition-[right] duration-200 motion-reduce:transition-none"
            positionStyle={{ right: controlsRight, bottom: isMobile ? snapHeight(listSnap, frameHeight) + 12 : BOTTOM_INSET }}
          />
        ) : null}

        {/* Drawer */}
        {drawer && !isMobile ? (
          <div
            className={cn(surfaceClass, "absolute z-20 overflow-hidden")}
            style={{ right: GAP, top: GAP, bottom: BOTTOM_INSET, width: isDesktop ? DRAWER_W : TABLET_DRAWER_W }}
          >
            {drawer}
          </div>
        ) : null}

        {/* Mobile sheets */}
        {isMobile ? (
          drawer ? (
            <BottomSheet
              snap={detailSnap}
              onSnap={setDetailSnap}
              frameHeight={frameHeight}
              half={Math.min(500, frameHeight - 80)}
              label="Facility details"
              testId="asset-map-detail-sheet"
            >
              {drawer}
            </BottomSheet>
          ) : (
            <BottomSheet snap={listSnap} onSnap={setListSnap} frameHeight={frameHeight} label="Facility list" testId="asset-map-list-sheet">
              <FacilityPanel {...panelProps} variant="sheet" showTypeChips={false} className="min-h-0 flex-1" />
            </BottomSheet>
          )
        ) : null}
      </div>
    </div>
  );
}

function RailButton({
  label,
  onClick,
  badge,
  children,
}: {
  label: string;
  onClick: () => void;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={badge ? `${label} (${badge} on)` : label}
      title={label}
      onClick={onClick}
      className={cn("relative grid h-11 w-11 place-items-center rounded-[10px] hover:bg-[#F3F4F6] dark:hover:bg-[#1E2B3C]", focusRing)}
    >
      {children}
      {badge ? (
        <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#0B2545] px-1 text-[10px] font-semibold text-white dark:bg-[#E6EAF0] dark:text-[#0F1724]">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
