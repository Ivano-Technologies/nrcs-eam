/**
 * Default viewport for NRCS EAM maps (Nigeria). Used when no explicit center is passed
 * or when there are no coordinates to fit.
 */
export const DEFAULT_MAP_CENTER = { lat: 9.082, lng: 8.6753 } as const;

/** Country-level overview (~Nigeria). Use 12–15 for city / facility detail. */
export const DEFAULT_MAP_ZOOM_COUNTRY = 6;
