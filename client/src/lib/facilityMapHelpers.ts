/**
 * Stock readiness tiers and colours for the Asset Map (pins, tiles, bars, pills).
 * Thresholds: Good 75% and up, Partial 50 to 74%, Low under 50%. "Partial" matches the
 * dashboard wording (Kezie, 8 Oct 2026). Low uses #B91C1C, deliberately not brand red.
 */

export type ReadinessTier = "good" | "partial" | "low" | "none";
/** Pin state: an inactive facility is drawn hollow as "offline". */
export type PinTier = ReadinessTier | "offline";
export type MapScheme = "light" | "dark";

/** Kept for older callers: "all" means no readiness filter. */
export type StockTier = "all" | ReadinessTier;

export type StockPinInput = {
  isActive: boolean;
  stockScorePercent: number | null;
  totalCards: number;
};

export const READINESS_TIERS: readonly ReadinessTier[] = ["good", "partial", "low", "none"];

export const READINESS_LABELS: Record<PinTier, string> = {
  good: "Good",
  partial: "Partial",
  low: "Low",
  none: "No data",
  offline: "Offline",
};

export const READINESS_THRESHOLDS: Record<ReadinessTier, string> = {
  good: "75% and up",
  partial: "50 to 74%",
  low: "Under 50%",
  none: "No cards",
};

export const READINESS_COLOURS: Record<MapScheme, Record<PinTier, string>> = {
  light: {
    good: "#15803D",
    partial: "#D97706",
    low: "#B91C1C",
    none: "#878C95",
    offline: "#6B7280",
  },
  dark: {
    good: "#22A35A",
    partial: "#F59E0B",
    low: "#EF4444",
    none: "#64748B",
    offline: "#8A9AB0",
  },
};

/** Pill text and background (light) and text (dark) per tier. */
export const READINESS_PILLS: Record<PinTier, { lightFg: string; lightBg: string; darkFg: string }> = {
  good: { lightFg: "#166534", lightBg: "#DCFCE7", darkFg: "#4ADE80" },
  partial: { lightFg: "#92400E", lightBg: "#FEF3C7", darkFg: "#FBBF24" },
  low: { lightFg: "#991B1B", lightBg: "#FEE2E2", darkFg: "#F87171" },
  none: { lightFg: "#4B5563", lightBg: "#EEF0F3", darkFg: "#A3AEBD" },
  offline: { lightFg: "#4B5563", lightBg: "transparent", darkFg: "#A3AEBD" },
};

export const ASSET_STATUS_COLOURS: Record<MapScheme, { inUse: string; maintenance: string; retired: string }> = {
  light: { inUse: "#1D4ED8", maintenance: "#5B8DEF", retired: "#878C95" },
  dark: { inUse: "#60A5FA", maintenance: "#2F6FD6", retired: "#64748B" },
};

export function hasStockData(facility: StockPinInput): boolean {
  return facility.stockScorePercent != null && facility.totalCards > 0;
}

/** Readiness tier used for filters and tile counts. Inactive facilities count as "No data". */
export function readinessTier(facility: StockPinInput): ReadinessTier {
  if (!facility.isActive || !hasStockData(facility)) return "none";
  const score = facility.stockScorePercent as number;
  if (score >= 75) return "good";
  if (score >= 50) return "partial";
  return "low";
}

/** Tier used to draw the pin (inactive facilities are hollow "offline" pins). */
export function pinTier(facility: StockPinInput): PinTier {
  if (!facility.isActive) return "offline";
  return readinessTier(facility);
}

export function stockPinColorForTest(facility: StockPinInput, scheme: MapScheme = "light"): string {
  return READINESS_COLOURS[scheme][pinTier(facility)];
}

export function matchesStockTierForTest(facility: StockPinInput, tier: StockTier): boolean {
  if (tier === "all") return true;
  return readinessTier(facility) === tier;
}
