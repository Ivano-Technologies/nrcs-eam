/**
 * Desktop overlay geometry for the Asset Map: when the left panel and the right drawer leave too
 * little map between them, the panel collapses to a compact search card while the drawer is open.
 */
import type { Insets } from "./useMapSelection";

export const MAP_GAP = 16;
export const PANEL_W = 360;
export const DRAWER_W = 368;
/** Compact card shown instead of the panel while the drawer is open on a narrow map. */
export const COMPACT_PANEL_W = 224;
/** Below this much free map between the panel and the open drawer, the panel collapses. */
export const MIN_FREE_MAP_W = 480;
/** The selected pin's label is centred above the pin: room it needs beside and above the pin. */
export const LABEL_ROOM_X = 100;
export const LABEL_ROOM_TOP = 24;
/** panIntoFreeArea keeps this margin inside the free area. */
const PAN_MARGIN = 32;

/** Free map width between the full panel and the open drawer. */
export function freeMapWidth(frameWidth: number): number {
  return frameWidth - (MAP_GAP + PANEL_W + MAP_GAP) - (MAP_GAP + DRAWER_W + MAP_GAP);
}

/** True when the desktop panel should collapse whenever the drawer is open. Unknown width never collapses. */
export function isNarrowMap(frameWidth: number): boolean {
  return frameWidth > 0 && freeMapWidth(frameWidth) < MIN_FREE_MAP_W;
}

/** Left edge of the free map area for the desktop panel state. */
export function desktopLeftInset(collapsed: boolean): number {
  return MAP_GAP + (collapsed ? COMPACT_PANEL_W : PANEL_W) + MAP_GAP;
}

/** Right edge inset when the desktop drawer is open. */
export const DRAWER_RIGHT_INSET = MAP_GAP + DRAWER_W + MAP_GAP;

/**
 * Insets used to pan a selected pin into view while the panel is collapsed: the free area shrunk by
 * the label's room, so both the pin and its label land between the compact card and the drawer.
 * The room is reduced when the free area is too small for it, so a pan is still possible.
 */
export function withLabelRoom(insets: Insets, frameWidth: number): Insets {
  const free = frameWidth - insets.left - insets.right - 2 * PAN_MARGIN;
  const roomX = Math.max(0, Math.min(LABEL_ROOM_X, Math.floor((free - 40) / 2)));
  return { ...insets, left: insets.left + roomX, right: insets.right + roomX, top: insets.top + LABEL_ROOM_TOP };
}

export type LayerBarPlacement =
  /** Centred in the free area between the compact card and the drawer. */
  | { mode: "centred"; left: number; width: number }
  /** The free area is narrower than the bar: stack it under the compact card instead. */
  | { mode: "belowCard"; left: number; top: number };

export function collapsedLayerBarPlacement(opts: {
  frameWidth: number;
  layerBarWidth: number;
  compactCardHeight: number;
}): LayerBarPlacement {
  const left = desktopLeftInset(true);
  const width = opts.frameWidth - left - DRAWER_RIGHT_INSET;
  if (width >= opts.layerBarWidth) return { mode: "centred", left, width };
  return { mode: "belowCard", left: MAP_GAP, top: MAP_GAP + opts.compactCardHeight + 8 };
}

/** Phones: the map empty card only shows when the list sheet is at peek and no detail sheet is open. */
export function showMobileEmptyCard(listSnap: "peek" | "half" | "full", detailOpen: boolean): boolean {
  return !detailOpen && listSnap === "peek";
}
