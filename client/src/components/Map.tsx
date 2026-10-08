/**
 * Google Maps for NRCS EAM (`MapView`), shared by the Asset Map and the Facilities map view.
 *
 * - The Maps JavaScript API script is injected at most once per page load (memoised promise,
 *   early return when `window.google.maps` already exists).
 * - The map uses a real Map ID from `VITE_GOOGLE_MAPS_MAP_ID` (light and dark cloud styles
 *   attached in Google Cloud Console). Without it we fall back to Google's `DEMO_MAP_ID`, which
 *   still supports Advanced Markers but has no custom styling.
 * - `colorScheme` can only be set when a map is created. When the caller passes a new scheme,
 *   MapView creates a second map once, carries the centre and zoom across, and keeps both
 *   instances alive so later theme switches reuse them (no new map, no new script).
 *
 * Usage:
 *   <MapView onMapReady={(map) => { mapRef.current = map; }} />
 * New optional props (`mapId`, `colorScheme`, `gestureHandling`, `disableDefaultUI`, `options`,
 * `onTilesLoaded`, `errorDisplay`) default to the previous behaviour, so existing callers such
 * as the Facilities page keep working unchanged.
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM_COUNTRY } from "@/lib/mapDefaults";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
    gm_authFailure?: () => void;
    __nrcsGoogleMapsReady?: () => void;
  }
}

export type MapColorScheme = "LIGHT" | "DARK";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
const CONFIGURED_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim();

/** Map ID used by default. `DEMO_MAP_ID` is Google's unstyled testing ID. */
export const GOOGLE_MAPS_MAP_ID = CONFIGURED_MAP_ID || "DEMO_MAP_ID";
export const HAS_CONFIGURED_MAP_ID = Boolean(CONFIGURED_MAP_ID);

export type MapScriptResult = "ok" | "no_key" | "automation" | "failed";

let loadPromise: Promise<MapScriptResult> | null = null;
let injectedScripts = 0;

function isAutomation(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { webdriver?: boolean }).webdriver === true
  );
}

/** Test hook: how many times the Maps script tag was injected. */
export function mapsScriptInjectionCountForTest(): number {
  return injectedScripts;
}

/** Test hook: forget the memoised loader. */
export function resetMapsLoaderForTest(): void {
  loadPromise = null;
  injectedScripts = 0;
}

/**
 * Loads the Google Maps JavaScript API once. Safe to call from every mount.
 * Automated browsers (`navigator.webdriver`) never load Google; E2E uses `?mapMock=1`.
 */
export function loadMapScript(): Promise<MapScriptResult> {
  if (typeof window === "undefined") return Promise.resolve("failed");
  if (window.google?.maps?.Map) return Promise.resolve("ok");
  if (isAutomation()) return Promise.resolve("automation");
  if (!GOOGLE_MAPS_KEY) return Promise.resolve("no_key");
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<MapScriptResult>((resolve) => {
    window.__nrcsGoogleMapsReady = () => resolve("ok");
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_KEY,
      v: "weekly",
      loading: "async",
      libraries: "marker,places,geocoding,geometry",
      callback: "__nrcsGoogleMapsReady",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.dataset.nrcsMaps = "1";
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
      loadPromise = null;
      resolve("failed");
    };
    injectedScripts += 1;
    document.head.appendChild(script);
  });
  return loadPromise;
}

async function importMapLibraries(): Promise<void> {
  const maps = window.google?.maps;
  if (!maps) return;
  if (typeof maps.importLibrary === "function") {
    await Promise.all([maps.importLibrary("maps"), maps.importLibrary("marker")]);
  }
}

const authFailureListeners = new Set<() => void>();
function ensureAuthFailureHook() {
  if (typeof window === "undefined") return;
  const marker = "__nrcsAuthHook";
  const current = window.gm_authFailure as (((...a: unknown[]) => void) & { [marker]?: boolean }) | undefined;
  if (current?.[marker]) return;
  const previous = current;
  const hook = Object.assign(
    () => {
      authFailureListeners.forEach((fn) => fn());
      previous?.();
    },
    { [marker]: true }
  );
  window.gm_authFailure = hook;
}

export function mapLoadErrorMessage(result: Exclude<MapScriptResult, "ok"> | "auth"): string {
  switch (result) {
    case "no_key":
      return "Google Maps is not configured for this environment.";
    case "automation":
      return "Google Maps does not load in automated test runs.";
    case "auth": {
      const host = typeof window !== "undefined" ? window.location.host : "this host";
      return `Google Maps rejected this host. Add ${host} to the API key HTTP referrer allowlist.`;
    }
    default:
      return "Google Maps did not load. Check the API key and HTTP referrer allowlist.";
  }
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
  onLoadError?: (message: string) => void;
  /** Defaults to `VITE_GOOGLE_MAPS_MAP_ID`, else `DEMO_MAP_ID`. */
  mapId?: string;
  /** When set, the map is created with this colour scheme (LIGHT or DARK cloud style). */
  colorScheme?: MapColorScheme;
  gestureHandling?: google.maps.MapOptions["gestureHandling"];
  /** Hide all of Google's own controls (the caller renders its own). */
  disableDefaultUI?: boolean;
  /** Extra options applied when each map instance is created (minZoom, restriction, ...). */
  options?: google.maps.MapOptions;
  onTilesLoaded?: () => void;
  /** "overlay" (default) shows the message over the map; "none" leaves it to the caller. */
  errorDisplay?: "overlay" | "none";
}

export function MapView({
  className,
  initialCenter = { ...DEFAULT_MAP_CENTER },
  initialZoom = DEFAULT_MAP_ZOOM_COUNTRY,
  onMapReady,
  onLoadError,
  mapId = GOOGLE_MAPS_MAP_ID,
  colorScheme,
  gestureHandling,
  disableDefaultUI = false,
  options,
  onTilesLoaded,
  errorDisplay = "overlay",
}: MapViewProps) {
  const activeScheme: MapColorScheme = colorScheme ?? "LIGHT";
  const [schemes, setSchemes] = useState<MapColorScheme[]>([activeScheme]);
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containers = useRef<Partial<Record<MapColorScheme, HTMLDivElement | null>>>({});
  const instances = useRef<Partial<Record<MapColorScheme, google.maps.Map>>>({});
  const lastActive = useRef<MapColorScheme | null>(null);

  const fail = usePersistFn((message: string) => {
    setErrorMessage(message);
    onLoadError?.(message);
  });

  const tilesLoaded = usePersistFn(() => onTilesLoaded?.());

  useEffect(() => {
    let cancelled = false;
    const onAuthFailure = () => fail(mapLoadErrorMessage("auth"));
    ensureAuthFailureHook();
    authFailureListeners.add(onAuthFailure);
    (async () => {
      const result = await loadMapScript();
      if (cancelled) return;
      if (result !== "ok") {
        fail(mapLoadErrorMessage(result));
        return;
      }
      if (!window.google?.maps) {
        fail(mapLoadErrorMessage("failed"));
        return;
      }
      try {
        await importMapLibraries();
      } catch {
        if (!cancelled) fail(mapLoadErrorMessage("failed"));
        return;
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
      authFailureListeners.delete(onAuthFailure);
    };
  }, [fail]);

  // Make sure a container exists for the requested scheme (state adjusted during render).
  if (!schemes.includes(activeScheme)) {
    setSchemes([...schemes, activeScheme]);
  }

  const activate = usePersistFn(() => {
    if (!ready || !window.google?.maps) return;
    const container = containers.current[activeScheme];
    if (!container) return;
    const previous = lastActive.current ? instances.current[lastActive.current] : undefined;
    let map = instances.current[activeScheme];
    if (!map) {
      const center = previous?.getCenter()?.toJSON() ?? initialCenter;
      const zoom = previous?.getZoom() ?? initialZoom;
      const mapOptions: google.maps.MapOptions = {
        zoom,
        center,
        mapId,
        ...(disableDefaultUI
          ? {
              disableDefaultUI: true,
              mapTypeControl: false,
              fullscreenControl: false,
              zoomControl: false,
              streetViewControl: false,
              cameraControl: false,
            }
          : {
              mapTypeControl: true,
              fullscreenControl: true,
              zoomControl: true,
              streetViewControl: true,
            }),
        ...(gestureHandling ? { gestureHandling } : {}),
        ...(colorScheme ? { colorScheme: colorScheme as google.maps.ColorScheme } : {}),
        ...options,
      };
      map = new window.google.maps.Map(container, mapOptions);
      map.addListener("tilesloaded", tilesLoaded);
      instances.current[activeScheme] = map;
    } else if (previous && previous !== map) {
      const center = previous.getCenter();
      const zoom = previous.getZoom();
      if (center) map.setCenter(center);
      if (zoom != null) map.setZoom(zoom);
      const typeId = previous.getMapTypeId();
      if (typeId) map.setMapTypeId(typeId);
    }
    if (lastActive.current !== activeScheme || !previous) {
      lastActive.current = activeScheme;
      onMapReady?.(map);
    }
  });

  useEffect(() => {
    activate();
  }, [ready, activeScheme, schemes, activate]);

  return (
    <div
      data-testid="asset-map-container"
      data-map-ready={ready ? "true" : "false"}
      className={cn("relative w-full min-h-[500px] h-[500px] bg-muted/40", className)}
    >
      {schemes.map((scheme) => (
        <div
          key={scheme}
          ref={(el) => {
            containers.current[scheme] = el;
          }}
          data-color-scheme={scheme.toLowerCase()}
          aria-hidden={scheme !== activeScheme ? true : undefined}
          className="absolute inset-0"
          style={{
            visibility: scheme === activeScheme ? "visible" : "hidden",
            pointerEvents: scheme === activeScheme ? undefined : "none",
          }}
        />
      ))}
      {errorMessage && errorDisplay === "overlay" ? (
        <div
          role="alert"
          data-testid="asset-map-error"
          className="absolute inset-0 flex items-center justify-center bg-muted/90 p-6 text-center text-sm text-foreground"
        >
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
