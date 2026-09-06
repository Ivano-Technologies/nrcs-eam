/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 9.082, lng: 8.6753 }}
 *   initialZoom={6}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Store to control map from parent anytime, google map itself is in charge of the re-rendering, not react state.
 * </MapView>
 *
 * ======
 * Available Libraries and Core Features:
 * -------------------------------
 * 📍 MARKER (from `marker` library)
 * - Attaches to map using { map, position }
 * new google.maps.marker.AdvancedMarkerElement({
 *   map,
 *   position: { lat: 9.082, lng: 8.6753 },
 *   title: "Example",
 * });
 *
 * -------------------------------
 * 🏢 PLACES (from `places` library)
 * - Does not attach directly to map; use data with your map manually.
 * const place = new google.maps.places.Place({ id: PLACE_ID });
 * await place.fetchFields({ fields: ["displayName", "location"] });
 * map.setCenter(place.location);
 * new google.maps.marker.AdvancedMarkerElement({ map, position: place.location });
 *
 * -------------------------------
 * 🧭 GEOCODER (from `geocoding` library)
 * - Standalone service; manually apply results to map.
 * const geocoder = new google.maps.Geocoder();
 * geocoder.geocode({ address: "New York" }, (results, status) => {
 *   if (status === "OK" && results[0]) {
 *     map.setCenter(results[0].geometry.location);
 *     new google.maps.marker.AdvancedMarkerElement({
 *       map,
 *       position: results[0].geometry.location,
 *     });
 *   }
 * });
 *
 * -------------------------------
 * 📐 GEOMETRY (from `geometry` library)
 * - Pure utility functions; not attached to map.
 * const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
 *
 * -------------------------------
 * 🛣️ ROUTES (from `routes` library)
 * - Combines DirectionsService (standalone) + DirectionsRenderer (map-attached)
 * const directionsService = new google.maps.DirectionsService();
 * const directionsRenderer = new google.maps.DirectionsRenderer({ map });
 * directionsService.route(
 *   { origin, destination, travelMode: "DRIVING" },
 *   (res, status) => status === "OK" && directionsRenderer.setDirections(res)
 * );
 *
 * -------------------------------
 * 🌦️ MAP LAYERS (attach directly to map)
 * - new google.maps.TrafficLayer().setMap(map);
 * - new google.maps.TransitLayer().setMap(map);
 * - new google.maps.BicyclingLayer().setMap(map);
 *
 * -------------------------------
 * ✅ SUMMARY
 * - “map-attached” → AdvancedMarkerElement, DirectionsRenderer, Layers.
 * - “standalone” → Geocoder, DirectionsService, DistanceMatrixService, ElevationService.
 * - “data-only” → Place, Geometry utilities.
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
  }
}

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
const FORGE_API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY?.trim();
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

function loadMapScript() {
  const webdriver =
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { webdriver?: boolean }).webdriver === true;
  if (webdriver) {
    return Promise.resolve();
  }
  const useDirectGoogle = Boolean(GOOGLE_MAPS_KEY);
  const useForge = Boolean(FORGE_API_KEY) && !useDirectGoogle;
  if (!useDirectGoogle && !useForge) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = useDirectGoogle
      ? `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&v=weekly&libraries=marker,places,geocoding,geometry`
      : `${MAPS_PROXY_URL}/maps/api/js?key=${FORGE_API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      resolve(null);
      script.remove();
    };
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
      resolve(new Error("script_failed"));
    };
    document.head.appendChild(script);
  });
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
  onLoadError?: (message: string) => void;
}

export function MapView({
  className,
  initialCenter = { ...DEFAULT_MAP_CENTER },
  initialZoom = DEFAULT_MAP_ZOOM_COUNTRY,
  onMapReady,
  onLoadError,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fail = usePersistFn((message: string) => {
    setErrorMessage(message);
    onLoadError?.(message);
  });

  const init = usePersistFn(async () => {
    const previousAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      fail(
        "Google Maps rejected this host. Add blue.nrcseam.techivano.com to the API key HTTP referrer allowlist."
      );
      previousAuthFailure?.();
    };
    const scriptResult = await loadMapScript();
    if (scriptResult instanceof Error) {
      fail("Google Maps did not load. Check the API key and HTTP referrer allowlist.");
      return;
    }
    const hasKey = Boolean(GOOGLE_MAPS_KEY || FORGE_API_KEY);
    if (!hasKey) {
      fail("Google Maps is not configured for this environment.");
      return;
    }
    if (!window.google?.maps) {
      fail("Google Maps did not load. Check the API key and HTTP referrer allowlist.");
      return;
    }
    if (!mapContainer.current) {
      fail("Map container not found");
      return;
    }
    map.current = new window.google.maps.Map(mapContainer.current, {
      zoom: initialZoom,
      center: initialCenter,
      mapTypeControl: true,
      fullscreenControl: true,
      zoomControl: true,
      streetViewControl: true,
      mapId: "DEMO_MAP_ID",
    });
    if (onMapReady) {
      onMapReady(map.current);
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="relative w-full">
      <div
        ref={mapContainer}
        data-testid="asset-map-container"
        className={cn("w-full min-h-[500px] h-[500px] bg-muted/40", className)}
      />
      {errorMessage ? (
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
