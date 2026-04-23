import { appPath } from "@/lib/routes";

const TRACKING_SEGMENTS = [
  "tracking",
  "tracking/stock-cards",
  "tracking/bin-cards",
  "movements",
  "transfers",
  "counts",
  "stock-takes",
  "adjustments",
  "expiry",
  "kits",
  "distributions",
  "import",
  "import/drafts",
] as const;

/** Full path prefixes (under /app) for Inventory tracking hub + operational screens. */
export const INVENTORY_TRACKING_PATH_PREFIXES: string[] = TRACKING_SEGMENTS.map(
  (s) => appPath(`/inventory/${s}`).replace(/\/$/, "") || "/"
);

export function locationMatchesInventoryTracking(locPath: string): boolean {
  return INVENTORY_TRACKING_PATH_PREFIXES.some(
    (h) => locPath === h || locPath.startsWith(`${h}/`)
  );
}
