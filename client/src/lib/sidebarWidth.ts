/** Full sidebar width in px. Labels and the brand title fit at this width. */
export const SIDEBAR_FULL_WIDTH = 256;
/** Collapsed icon rail width in px. */
export const SIDEBAR_RAIL_WIDTH = 64;
/**
 * Sidebar text (labels, brand, search field, user name) stays mounted in the rail and fades: out
 * at once when folding, in after a 100ms delay when unfolding (pair with `delay-100` on the
 * visible state). Off under reduced motion.
 */
export const SIDEBAR_FADE = "transition-opacity duration-100 ease-out motion-reduce:transition-none";
/** Widths below this snap to the icon rail, at or above it to the full sidebar. */
const SNAP_THRESHOLD = (SIDEBAR_FULL_WIDTH + SIDEBAR_RAIL_WIDTH) / 2;

/**
 * The sidebar has exactly two widths. Any stored or dragged value (including
 * legacy saved widths such as 80, 280 or 360) is snapped to one of them so an
 * intermediate width never clips nav labels or the brand title.
 */
export function snapSidebarWidth(width: number | null | undefined): number {
  if (width == null || !Number.isFinite(width)) return SIDEBAR_FULL_WIDTH;
  return width < SNAP_THRESHOLD ? SIDEBAR_RAIL_WIDTH : SIDEBAR_FULL_WIDTH;
}
