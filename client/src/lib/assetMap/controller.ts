/**
 * What the Asset Map page may ask of a map. Implemented for Google Maps and for the
 * `?mapMock=1` DOM stub used by E2E tests. Note there is no "select" here: selection only
 * ever uses `ensureVisible`, which pans and never zooms.
 */
import type { LatLng } from "./curves";
import { panIntoFreeArea, type Insets } from "./useMapSelection";

export type MapStyle = "default" | "satellite";

export interface MapController {
  zoomBy(delta: number): void;
  /** Animated fit. Only for first load and the Fit all facilities button. */
  fitTo(points: LatLng[], insets: Insets): void;
  /** Pan just enough to bring a point into the free area. Never changes zoom. */
  ensureVisible(point: LatLng, insets: Insets): void;
  setStyle(style: MapStyle): void;
  getZoom(): number | undefined;
  /** Release anything the controller attached to the map. */
  dispose?(): void;
}

/**
 * Wraps a controller so a dead or rejected Maps API can never throw into React. After `disable()`
 * (or the first thrown call) every method is a no op and `onFailure` has been called once.
 */
export function guardController(
  inner: MapController,
  onFailure: (error: unknown) => void
): MapController & { disable(): void; readonly disabled: boolean } {
  let dead = false;
  const release = () => {
    try {
      inner.dispose?.();
    } catch {
      // Already failing.
    }
  };
  const run = <T>(fn: () => T): T | undefined => {
    if (dead) return undefined;
    try {
      return fn();
    } catch (error) {
      dead = true;
      release();
      onFailure(error);
      return undefined;
    }
  };
  return {
    zoomBy: (delta) => void run(() => inner.zoomBy(delta)),
    fitTo: (points, insets) => void run(() => inner.fitTo(points, insets)),
    ensureVisible: (point, insets) => void run(() => inner.ensureVisible(point, insets)),
    setStyle: (style) => void run(() => inner.setStyle(style)),
    getZoom: () => run(() => inner.getZoom()),
    dispose: release,
    disable() {
      if (dead) return;
      dead = true;
      release();
    },
    get disabled() {
      return dead;
    },
  };
}

class ProjectionProbe {
  overlay: google.maps.OverlayView;
  constructor(map: google.maps.Map) {
    const overlay = new google.maps.OverlayView();
    overlay.onAdd = () => {};
    overlay.draw = () => {};
    overlay.onRemove = () => {};
    overlay.setMap(map);
    this.overlay = overlay;
  }
  toPixel(point: LatLng): { x: number; y: number } | null {
    const projection = this.overlay.getProjection();
    if (!projection) return null;
    const p = projection.fromLatLngToContainerPixel(new google.maps.LatLng(point.lat, point.lng));
    return p ? { x: p.x, y: p.y } : null;
  }
}

/**
 * Padding for fitBounds: the overlay insets plus a little air, scaled down when they would
 * leave less than 120px free (Google ignores padding that doesn't fit).
 */
export function fitPadding(insets: Insets, size: { width: number; height: number }, air = 24): google.maps.Padding {
  const pad = { top: insets.top + air, right: insets.right + air, bottom: insets.bottom + air, left: insets.left + air };
  const squeeze = (a: number, b: number, total: number) => {
    if (!total || total - a - b >= 120) return [a, b];
    const k = Math.max(0, total - 120) / Math.max(1, a + b);
    return [Math.floor(a * k), Math.floor(b * k)];
  };
  [pad.left, pad.right] = squeeze(pad.left, pad.right, size.width);
  [pad.top, pad.bottom] = squeeze(pad.top, pad.bottom, size.height);
  return pad;
}

export function createGoogleController(map: google.maps.Map): MapController {
  const probe = new ProjectionProbe(map);
  return {
    zoomBy(delta) {
      const z = map.getZoom() ?? 6;
      map.setZoom(z + delta);
    },
    fitTo(points, insets) {
      if (points.length === 0) return;
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      const div = map.getDiv();
      map.fitBounds(bounds, fitPadding(insets, { width: div?.clientWidth ?? 0, height: div?.clientHeight ?? 0 }));
    },
    ensureVisible(point, insets) {
      const px = probe.toPixel(point);
      const div = map.getDiv();
      if (!px || !div) {
        return;
      }
      panIntoFreeArea(map, px, { width: div.clientWidth, height: div.clientHeight }, insets);
    },
    setStyle(style) {
      map.setMapTypeId(style === "satellite" ? "hybrid" : "roadmap");
    },
    getZoom() {
      return map.getZoom();
    },
    dispose() {
      probe.overlay.setMap(null);
    },
  };
}
