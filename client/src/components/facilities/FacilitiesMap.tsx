/**
 * Facilities page Map view. Reuses the Asset Map pieces (MapView, AssetMapOverlay, MockMapCanvas,
 * MapControls, NoLocationChip, FacilityDrawer, BottomSheet) with pins coloured by status:
 * active facilities in the good token, inactive ones solid grey with a white outline.
 * The toolbar above owns the filters; this view only shows the facilities it is handed.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { FACILITY_TYPE_VALUES, type FacilityType } from "@shared/facilities";
import { MapView, mapLoadErrorMessage, type MapColorScheme } from "@/components/Map";
import { MockMapCanvas } from "@/components/assetMap/MockMapCanvas";
import { BottomSheet, type SheetSnap } from "@/components/assetMap/BottomSheet";
import { FacilityDrawer } from "@/components/assetMap/FacilityDrawer";
import { MapControls, MapErrorCard, NoLocationChip } from "@/components/assetMap/MapChrome";
import { focusRing, linkText, mutedText, surfaceClass, TypeGlyph, useMapScheme, useMediaQuery } from "@/components/assetMap/parts";
import { createGoogleController, guardController, type MapController, type MapStyle } from "@/lib/assetMap/controller";
import { AssetMapOverlay } from "@/lib/assetMap/googleOverlay";
import { facilityPosition, type MapFacility } from "@/lib/assetMap/model";
import { useMapSelection, type Insets } from "@/lib/assetMap/useMapSelection";
import { READINESS_COLOURS, type MapScheme } from "@/lib/facilityMapHelpers";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM_COUNTRY } from "@/lib/mapDefaults";
import { appPath } from "@/lib/routes";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const GAP = 16;
const DRAWER_W = 368;
const TABLET_DRAWER_W = 360;
/** Keeps Google's logo and attribution visible below the legend and controls. */
const BOTTOM_INSET = 40;

const MAP_OPTIONS: google.maps.MapOptions = {
  minZoom: 5,
  clickableIcons: false,
  keyboardShortcuts: true,
  restriction: { latLngBounds: { north: 26, south: -20, west: -16, east: 32 }, strictBounds: false },
};
const MOBILE_MAP_OPTIONS: google.maps.MapOptions = {
  ...MAP_OPTIONS,
  minZoom: 4,
  restriction: { latLngBounds: { north: 45, south: -50, west: -35, east: 50 }, strictBounds: false },
};

const LEGEND_TYPE_LABEL: Record<FacilityType, string> = {
  national_headquarters: "National HQ",
  branch: "Branch",
  division: "Division",
  clinic: "Clinic",
  warehouse: "Warehouse",
};
const LEGEND_TYPES: FacilityType[] = ["national_headquarters", "branch", "division", "clinic", "warehouse"];

export type NoLocationRow = { id: number; name: string; code?: string | null; state?: string | null };

export type FacilitiesMapProps = {
  /** Ids that pass the toolbar filters. */
  visibleIds: Set<number>;
  /** Filtered facilities that have no coordinates (feeds the chip and its list). */
  noLocation: NoLocationRow[];
};

function readMapMock(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("mapMock") === "1";
}

/** Fills the window below the frame's top edge, leaving `reserve` px at the bottom. */
function useFillHeight(ref: React.RefObject<HTMLElement | null>, reserve: number, min: number): number {
  const [h, setH] = useState(min);
  useLayoutEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setH(Math.max(min, Math.round(window.innerHeight - top - reserve)));
    };
    update();
    window.addEventListener("resize", update);
    const ro = typeof ResizeObserver !== "undefined" && ref.current?.parentElement ? new ResizeObserver(update) : null;
    if (ro && ref.current?.parentElement) ro.observe(ref.current.parentElement);
    return () => {
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, [ref, reserve, min]);
  return h;
}

function StatusDot({ tier, scheme }: { tier: "good" | "offline"; scheme: MapScheme }) {
  const colour = READINESS_COLOURS[scheme][tier];
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{
        background: colour,
        // Inactive: solid grey with a white outline, as on the map.
        boxShadow: tier === "offline" ? `0 0 0 1.5px #FFFFFF, 0 0 0 2.5px ${colour}` : undefined,
      }}
    />
  );
}

function Legend({
  scheme,
  active,
  inactive,
  compact,
  className,
  style,
}: {
  scheme: MapScheme;
  active: number;
  inactive: number;
  compact: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      data-testid="facilities-map-legend"
      role="group"
      aria-label="Map legend"
      className={cn(surfaceClass, "space-y-1.5 px-3 py-2 text-xs", className)}
      style={style}
    >
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn("font-semibold", mutedText)}>Status</span>
        <span className="inline-flex items-center gap-1.5">
          <StatusDot tier="good" scheme={scheme} />
          Active <span className="tabular-nums font-semibold">{active}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StatusDot tier="offline" scheme={scheme} />
          Inactive <span className="tabular-nums font-semibold">{inactive}</span>
        </span>
      </p>
      {!compact ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={cn("font-semibold", mutedText)}>Type</span>
          {LEGEND_TYPES.filter((t) => FACILITY_TYPE_VALUES.includes(t)).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <TypeGlyph type={t} scheme={scheme} neutral="chip" size={14} />
              {LEGEND_TYPE_LABEL[t]}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

export function FacilitiesMap({ visibleIds, noLocation }: FacilitiesMapProps) {
  const [mapMock] = useState(readMapMock);
  const scheme = useMapScheme();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isMobile = !useMediaQuery("(min-width: 640px)");
  const touch = useMediaQuery("(pointer: coarse)");

  /* data */
  const mapQuery = trpc.sites.mapFacilities.useQuery(undefined, { staleTime: 5 * 60_000, refetchOnWindowFocus: false });
  const all: MapFacility[] = useMemo(() => mapQuery.data?.facilities ?? [], [mapQuery.data]);
  const byId = useMemo(() => new Map(all.map((f) => [f.id, f])), [all]);
  const shown = useMemo(() => all.filter((f) => visibleIds.has(f.id) && facilityPosition(f)), [all, visibleIds]);
  const activeCount = shown.filter((f) => f.isActive).length;
  const inactiveCount = shown.length - activeCount;

  /* geometry */
  const frameRef = useRef<HTMLDivElement>(null);
  const frameHeight = useFillHeight(frameRef, isMobile ? 96 : 24, isMobile ? 380 : 440);
  const [showNoLocation, setShowNoLocation] = useState(false);
  const noLocationCount = noLocation.length;
  if (noLocationCount === 0 && showNoLocation) setShowNoLocation(false);
  const legendH = isMobile ? 34 : 60;
  const drawerW = isDesktop ? DRAWER_W : TABLET_DRAWER_W;

  const insetsFor = useCallback(
    (drawerOpen: boolean): Insets => ({
      top: GAP + (noLocationCount > 0 ? 48 : 0),
      right: drawerOpen && !isMobile ? GAP + drawerW + GAP : GAP + 48,
      bottom: drawerOpen && isMobile ? Math.min(500, frameHeight - 80) : BOTTOM_INSET + legendH + 8,
      left: GAP,
    }),
    [noLocationCount, isMobile, drawerW, frameHeight, legendH]
  );

  /* map plumbing (same contract as Asset Map) */
  const controllerRef = useRef<MapController | null>(null);
  const mockRef = useRef<MapController | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapErrorRef = useRef<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("default");
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [detailSnap, setDetailSnap] = useState<SheetSnap>("half");

  const byIdRef = useRef(byId);
  const insetsRef = useRef(insetsFor);
  useLayoutEffect(() => {
    byIdRef.current = byId;
    insetsRef.current = insetsFor;
  });
  const ensureVisible = useCallback((id: number) => {
    const f = byIdRef.current.get(id);
    const pos = f ? facilityPosition(f) : null;
    if (!pos || mapErrorRef.current) return;
    window.requestAnimationFrame(() => {
      if (mapErrorRef.current) return;
      controllerRef.current?.ensureVisible(pos, insetsRef.current(true));
    });
  }, []);
  const { selectedId, select, clear } = useMapSelection({ ensureVisible });
  const selected = selectedId != null ? byId.get(selectedId) : undefined;
  // A filter change that hides the selected facility closes its drawer.
  useEffect(() => {
    if (selectedId != null && !visibleIds.has(selectedId)) clear({ restoreFocus: false });
  }, [selectedId, visibleIds, clear]);

  const detailQuery = trpc.sites.mapFacilityDetail.useQuery(
    { id: selectedId ?? 0 },
    { enabled: selectedId != null, staleTime: 5 * 60_000, refetchOnWindowFocus: false }
  );

  const selectedIdRef = useRef(selectedId);
  useLayoutEffect(() => {
    selectedIdRef.current = selectedId;
  });
  const [callbacks] = useState(() => ({
    onSelect: (id: number, opener: HTMLElement | null) => {
      setDetailSnap("half");
      select(id, opener);
    },
    onHover: (id: number | null) => setHoveredId(id),
    onBackgroundClick: () => {
      if (selectedIdRef.current != null) clear({ restoreFocus: false });
    },
  }));

  const failMapRef = useRef<(message: string) => void>(() => {});
  const [overlay] = useState(() => (mapMock ? null : new AssetMapOverlay(callbacks)));
  useEffect(() => {
    overlay?.setFailureHandler(() => failMapRef.current(mapLoadErrorMessage("runtime")));
    return () => overlay?.destroy();
  }, [overlay]);

  const failMap = useCallback(
    (message: string) => {
      overlay?.disable();
      const controller = controllerRef.current as (MapController & { disable?: () => void }) | null;
      controller?.disable?.();
      if (!mapMock) controllerRef.current = null;
      mapRef.current = null;
      if (mapErrorRef.current) return;
      mapErrorRef.current = message;
      setMapError(message);
    },
    [overlay, mapMock]
  );
  useLayoutEffect(() => {
    failMapRef.current = failMap;
  });

  const onMapReady = useCallback(
    (map: google.maps.Map) => {
      if (mapErrorRef.current) return;
      try {
        controllerRef.current = guardController(createGoogleController(map), () => failMapRef.current(mapLoadErrorMessage("runtime")));
        mapRef.current = map;
        overlay?.setMap(map);
      } catch {
        failMapRef.current(mapLoadErrorMessage("runtime"));
        return;
      }
      setMapEpoch((n) => n + 1);
    },
    [overlay]
  );

  useEffect(() => {
    if (mapMock) controllerRef.current = mockRef.current;
  });

  useEffect(() => {
    if (!overlay || mapError) return;
    overlay.update({
      facilities: all,
      visibleIds,
      layer: "facilities",
      scheme,
      selectedId,
      hoveredId,
      lines: false,
      empty: false,
      touch,
      pinMode: "status",
    });
  }, [overlay, mapError, all, visibleIds, scheme, selectedId, hoveredId, touch, mapEpoch]);

  // First load: fit the facilities on the map once. Later filter changes never refit (Fit does).
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current || !mapQuery.data || mapError) return;
    if (!mapMock && !mapRef.current) return;
    const pts = (shown.length ? shown : all).map(facilityPosition).filter((p): p is google.maps.LatLngLiteral => Boolean(p));
    fittedRef.current = true;
    if (pts.length) controllerRef.current?.fitTo(pts, insetsFor(false));
  }, [mapQuery.data, mapEpoch, mapMock, shown, all, insetsFor, mapError]);

  // Esc closes the drawer and returns focus to the pin that opened it.
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

  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId != null) drawerRef.current?.focus({ preventScroll: true });
  }, [selectedId]);

  const fitAll = () => {
    const pts = (shown.length ? shown : all).map(facilityPosition).filter((p): p is google.maps.LatLngLiteral => Boolean(p));
    if (pts.length) controllerRef.current?.fitTo(pts, insetsFor(selectedId != null));
  };
  const changeStyle = (style: MapStyle) => {
    setMapStyle(style);
    controllerRef.current?.setStyle(style);
  };

  const colorScheme: MapColorScheme = scheme === "dark" ? "DARK" : "LIGHT";
  const drawerOpen = Boolean(selected);
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
      bottomFade
      className="h-full"
    />
  ) : null;
  const controlsRight = drawerOpen && !isMobile ? GAP + drawerW + GAP : GAP;

  return (
    <div
      ref={frameRef}
      data-testid="facilities-map"
      className="relative overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-[#ECEEF1] dark:border-[#26364A] dark:bg-[#121B28]"
      style={{ height: frameHeight }}
    >
      {mapError ? (
        <div data-testid="facilities-map-fallback" className="absolute inset-0 grid place-items-center bg-[#F3F4F6] p-4 dark:bg-[#0F1724]">
          <MapErrorCard message={mapError} listBelow={false} />
        </div>
      ) : mapMock ? (
        <MockMapCanvas
          ref={mockRef}
          facilities={all}
          visibleIds={visibleIds}
          layer="facilities"
          scheme={scheme}
          selectedId={selectedId}
          hoveredId={hoveredId}
          lines={false}
          empty={false}
          insets={insetsFor(false)}
          pinMode="status"
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
          onLoadError={failMap}
          errorDisplay="none"
        />
      )}

      {mapQuery.isError ? (
        <div className="absolute inset-x-0 top-1/3 z-10 flex justify-center px-4">
          <div className={cn(surfaceClass, "max-w-[360px] p-4 text-sm")} role="alert">
            <p className="font-semibold">Could not load facility locations</p>
            <button type="button" onClick={() => void mapQuery.refetch()} className={cn("mt-2 font-semibold hover:underline", linkText, focusRing)}>
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {/* No location chip, top left. Show lists the facilities so they can be given a location. */}
      <div className="pointer-events-none absolute z-10 flex flex-col items-start gap-2" style={{ left: GAP, top: GAP, right: isMobile ? GAP : undefined }}>
        <NoLocationChip
          count={noLocationCount}
          active={showNoLocation}
          onShow={() => setShowNoLocation((v) => !v)}
          className="pointer-events-auto"
        />
        {showNoLocation && noLocationCount > 0 ? (
          <div
            data-testid="facilities-map-no-location-list"
            className={cn(surfaceClass, "pointer-events-auto w-[300px] max-w-full overflow-hidden")}
          >
            <p className={cn("border-b border-[#E5E7EB] px-3 py-2 text-xs dark:border-[#26364A]", mutedText)}>
              Open a facility to add its location.
            </p>
            <ul className="max-h-[240px] overflow-y-auto overscroll-contain py-1 text-[13px]">
              {noLocation.map((r) => (
                <li key={r.id}>
                  <Link
                    href={appPath(`/facilities/${r.id}`)}
                    className={cn("flex items-baseline justify-between gap-3 px-3 py-2 hover:bg-[#F3F4F6] dark:hover:bg-[#1E2B3C]", focusRing)}
                  >
                    <span className="min-w-0 truncate font-medium">{r.name}</span>
                    <span className={cn("shrink-0 text-xs tabular-nums", mutedText)}>{r.code ?? r.state ?? ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Legend, bottom left (above Google's logo) */}
      {!(isMobile && drawerOpen) ? (
        <Legend
          scheme={scheme}
          active={activeCount}
          inactive={inactiveCount}
          compact={isMobile}
          className="absolute z-10"
          style={{ left: GAP, bottom: BOTTOM_INSET, maxWidth: `calc(100% - ${GAP * 2 + (isMobile ? 56 : 64)}px)` }}
        />
      ) : null}

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
          positionStyle={{ right: controlsRight, bottom: BOTTOM_INSET }}
        />
      ) : null}

      {drawer && !isMobile ? (
        <div className={cn(surfaceClass, "absolute z-20 overflow-hidden")} style={{ right: GAP, top: GAP, bottom: GAP, width: drawerW }}>
          {drawer}
        </div>
      ) : null}
      {drawer && isMobile ? (
        <BottomSheet
          snap={detailSnap}
          onSnap={setDetailSnap}
          frameHeight={frameHeight}
          half={Math.min(500, frameHeight - 80)}
          label="Facility details"
          testId="facilities-map-detail-sheet"
        >
          {drawer}
        </BottomSheet>
      ) : null}
    </div>
  );
}
