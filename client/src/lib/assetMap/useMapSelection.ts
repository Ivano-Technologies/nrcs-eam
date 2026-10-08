/**
 * Facility selection for the Asset Map.
 *
 * Selecting a pin, bubble or list row opens the drawer and, at most, pans the map so the pin
 * sits in the free area (not under the panel or drawer). It never calls fitBounds or setZoom.
 */
import { useCallback, useLayoutEffect, useRef, useState } from "react";

export type Insets = { top: number; right: number; bottom: number; left: number };
export type Point = { x: number; y: number };

/** The slice of google.maps.Map that selection is allowed to touch. */
export interface PannableMap {
  panBy(x: number, y: number): void;
}

/**
 * Pan just enough to bring `point` (container pixels) inside the free area.
 * Returns the pan applied, or null when the point is already visible.
 */
export function panIntoFreeArea(
  map: PannableMap,
  point: Point,
  size: { width: number; height: number },
  insets: Insets,
  margin = 32
): Point | null {
  const minX = insets.left + margin;
  const maxX = size.width - insets.right - margin;
  const minY = insets.top + margin;
  const maxY = size.height - insets.bottom - margin;
  if (maxX <= minX || maxY <= minY) return null;
  const clampedX = Math.min(Math.max(point.x, minX), maxX);
  const clampedY = Math.min(Math.max(point.y, minY), maxY);
  const dx = Math.round(point.x - clampedX);
  const dy = Math.round(point.y - clampedY);
  if (dx === 0 && dy === 0) return null;
  map.panBy(dx, dy);
  return { x: dx, y: dy };
}

export type UseMapSelectionOptions = {
  initialId?: number | null;
  /** Bring the facility into the free area (pan only). */
  ensureVisible?: (id: number) => void;
  onChange?: (id: number | null) => void;
};

export function useMapSelection({ initialId = null, ensureVisible, onChange }: UseMapSelectionOptions = {}) {
  const [selectedId, setSelectedId] = useState<number | null>(initialId);
  const openerRef = useRef<HTMLElement | null>(null);
  const ensureRef = useRef(ensureVisible);
  const changeRef = useRef(onChange);
  useLayoutEffect(() => {
    ensureRef.current = ensureVisible;
    changeRef.current = onChange;
  });

  const select = useCallback((id: number, opener?: HTMLElement | null) => {
    if (opener) openerRef.current = opener;
    setSelectedId(id);
    changeRef.current?.(id);
    ensureRef.current?.(id);
  }, []);

  const clear = useCallback((opts: { restoreFocus?: boolean } = {}) => {
    setSelectedId(null);
    changeRef.current?.(null);
    const opener = openerRef.current;
    openerRef.current = null;
    if (opts.restoreFocus !== false && opener && opener.isConnected) {
      opener.focus({ preventScroll: true });
    }
  }, []);

  return { selectedId, select, clear, setSelectedId };
}
