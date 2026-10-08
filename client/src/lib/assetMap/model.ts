/**
 * Asset Map state: one shared filter set for both layers, counts, sorting, URL sync and copy.
 */
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { FACILITY_TYPE_VALUES, type FacilityType } from "@shared/facilities";
import {
  READINESS_LABELS,
  READINESS_TIERS,
  pinTier,
  readinessTier,
  type PinTier,
  type ReadinessTier,
} from "@/lib/facilityMapHelpers";

export type MapFacilitiesResult = inferRouterOutputs<AppRouter>["sites"]["mapFacilities"];
export type MapFacility = MapFacilitiesResult["facilities"][number];
export type MapFacilityDetail = inferRouterOutputs<AppRouter>["sites"]["mapFacilityDetail"];

export type MapLayer = "facilities" | "assets";
export type ListSort = "readiness" | "assets" | "name";

export type MapFilters = {
  q: string;
  types: FacilityType[];
  tiers: ReadinessTier[];
  offlineOnly: boolean;
  noLocationOnly: boolean;
};

export const EMPTY_FILTERS: MapFilters = {
  q: "",
  types: [],
  tiers: [],
  offlineOnly: false,
  noLocationOnly: false,
};

/** Chip order and copy (type chips double as the shape legend). */
export const TYPE_ORDER: readonly FacilityType[] = [
  "national_headquarters",
  "branch",
  "division",
  "clinic",
  "warehouse",
];

export const TYPE_CHIP_LABELS: Record<FacilityType, string> = {
  national_headquarters: "HQ",
  branch: "Branches",
  division: "Divisions",
  clinic: "Clinics",
  warehouse: "Warehouses",
};

export const TYPE_LABELS: Record<FacilityType, string> = {
  national_headquarters: "National HQ",
  branch: "Branch",
  division: "Division",
  clinic: "Clinic",
  warehouse: "Warehouse",
};

export function hasLocation(f: Pick<MapFacility, "lat" | "lng">): boolean {
  return f.lat != null && f.lng != null && Number.isFinite(f.lat) && Number.isFinite(f.lng);
}

export function facilityPosition(f: Pick<MapFacility, "lat" | "lng">): google.maps.LatLngLiteral | null {
  return hasLocation(f) ? { lat: f.lat as number, lng: f.lng as number } : null;
}

export function hasActiveFilters(filters: MapFilters): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.types.length > 0 ||
    filters.tiers.length > 0 ||
    filters.offlineOnly ||
    filters.noLocationOnly
  );
}

function matchesQuery(f: MapFacility, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  return `${f.name} ${f.code ?? ""} ${f.state ?? ""} ${f.city ?? ""}`.toLowerCase().includes(query);
}

type Skip = { types?: boolean; tiers?: boolean };

export function matchesFilters(f: MapFacility, filters: MapFilters, skip: Skip = {}): boolean {
  if (!matchesQuery(f, filters.q)) return false;
  if (!skip.types && filters.types.length > 0 && !filters.types.includes(f.facilityType)) return false;
  if (!skip.tiers && filters.tiers.length > 0 && !filters.tiers.includes(readinessTier(f))) return false;
  if (filters.offlineOnly && f.isActive) return false;
  if (filters.noLocationOnly && hasLocation(f)) return false;
  return true;
}

export function filterFacilities(rows: MapFacility[], filters: MapFilters): MapFacility[] {
  return rows.filter((f) => matchesFilters(f, filters));
}

/** Tile counts respect every filter except readiness itself (so Clinics + Low shows 0). */
export function countByTier(rows: MapFacility[], filters: MapFilters): Record<ReadinessTier, number> {
  const out: Record<ReadinessTier, number> = { good: 0, partial: 0, low: 0, none: 0 };
  for (const f of rows) if (matchesFilters(f, filters, { tiers: true })) out[readinessTier(f)] += 1;
  return out;
}

/** Chip counts (also the shape legend) ignore the type and readiness filters, as in the mockup. */
export function countByType(rows: MapFacility[], filters: MapFilters): Record<FacilityType, number> {
  const out = Object.fromEntries(FACILITY_TYPE_VALUES.map((t) => [t, 0])) as Record<FacilityType, number>;
  for (const f of rows) if (matchesFilters(f, filters, { types: true, tiers: true })) out[f.facilityType] += 1;
  return out;
}

export function countNoLocation(rows: MapFacility[]): number {
  return rows.filter((f) => !hasLocation(f)).length;
}

const PIN_TIER_ORDER: Record<PinTier, number> = { low: 0, partial: 1, good: 2, none: 3, offline: 4 };

export function sortFacilities(rows: MapFacility[], sort: ListSort): MapFacility[] {
  const copy = [...rows];
  const byName = (a: MapFacility, b: MapFacility) => a.name.localeCompare(b.name);
  if (sort === "name") return copy.sort(byName);
  if (sort === "assets") {
    return copy.sort((a, b) => (b.assetCount ?? -1) - (a.assetCount ?? -1) || byName(a, b));
  }
  return copy.sort((a, b) => {
    const ta = PIN_TIER_ORDER[pinTier(a)];
    const tb = PIN_TIER_ORDER[pinTier(b)];
    if (ta !== tb) return ta - tb;
    const pa = a.stockScorePercent ?? 101;
    const pb = b.stockScorePercent ?? 101;
    return pa - pb || byName(a, b);
  });
}

export const SORT_LABELS: Record<ListSort, string> = {
  readiness: "Lowest readiness first",
  assets: "Most assets first",
  name: "Name",
};

/* ---------------- URL state ---------------- */

export type MapUrlState = {
  layer: MapLayer;
  lines: boolean;
  filters: MapFilters;
  facility: string | null;
  mapMock: boolean;
};

const TYPE_SET = new Set<string>(FACILITY_TYPE_VALUES);
const TIER_SET = new Set<string>(READINESS_TIERS);

function list<T extends string>(value: string | null, allowed: Set<string>): T[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is T => allowed.has(v));
}

export function parseMapSearch(search: string): MapUrlState {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    layer: p.get("layer") === "assets" ? "assets" : "facilities",
    lines: p.get("lines") === "1",
    facility: p.get("facility") || null,
    mapMock: p.get("mapMock") === "1",
    filters: {
      q: p.get("q") ?? "",
      types: list<FacilityType>(p.get("types"), TYPE_SET),
      tiers: list<ReadinessTier>(p.get("tiers"), TIER_SET),
      offlineOnly: p.get("offline") === "1",
      noLocationOnly: p.get("noloc") === "1",
    },
  };
}

export function buildMapSearch(state: MapUrlState): string {
  const p = new URLSearchParams();
  if (state.mapMock) p.set("mapMock", "1");
  if (state.layer === "assets") p.set("layer", "assets");
  if (state.lines) p.set("lines", "1");
  if (state.filters.q.trim()) p.set("q", state.filters.q.trim());
  if (state.filters.types.length) p.set("types", state.filters.types.join(","));
  if (state.filters.tiers.length) p.set("tiers", state.filters.tiers.join(","));
  if (state.filters.offlineOnly) p.set("offline", "1");
  if (state.filters.noLocationOnly) p.set("noloc", "1");
  if (state.facility) p.set("facility", state.facility);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** URL key for a facility: its code when it has one, else its numeric id. */
export function facilityUrlKey(f: Pick<MapFacility, "id" | "code">): string {
  return f.code?.trim() ? f.code.trim() : String(f.id);
}

export function findByUrlKey(rows: MapFacility[], key: string | null): MapFacility | undefined {
  if (!key) return undefined;
  const lower = key.toLowerCase();
  return rows.find((f) => (f.code ?? "").toLowerCase() === lower) ?? rows.find((f) => String(f.id) === key);
}

/* ---------------- copy and formatting ---------------- */

const TIER_SUMMARY: Record<ReadinessTier, string> = {
  good: "Good stock readiness",
  partial: "Partial stock readiness",
  low: "Low stock readiness",
  none: "No stock data",
};

export function filterSummary(filters: MapFilters): string {
  const parts: string[] = [];
  if (filters.q.trim()) parts.push(`“${filters.q.trim()}”`);
  if (filters.types.length) parts.push(filters.types.map((t) => TYPE_CHIP_LABELS[t]).join(", "));
  if (filters.tiers.length) {
    parts.push(
      filters.tiers.length === 1
        ? TIER_SUMMARY[filters.tiers[0]]
        : `${filters.tiers.map((t) => READINESS_LABELS[t]).join(", ")} stock readiness`
    );
  }
  if (filters.offlineOnly) parts.push("Offline");
  if (filters.noLocationOnly) parts.push("No location");
  return parts.join(" · ");
}

export function emptyContext(filters: MapFilters): string {
  if (filters.types.length === 1 && filters.tiers.length === 1 && !filters.q.trim()) {
    const type = TYPE_LABELS[filters.types[0]].toLowerCase();
    const tier = filters.tiers[0];
    const what = tier === "none" ? "has no stock data" : `has ${READINESS_LABELS[tier].toLowerCase()} stock readiness`;
    return `No ${type} ${what} right now. Remove a filter to see more.`;
  }
  if (filters.q.trim() && filters.types.length === 0 && filters.tiers.length === 0) {
    return "No facility name or code matches your search. Try another search.";
  }
  return "Nothing matches these filters right now. Remove a filter to see more.";
}

const numberFormat = new Intl.NumberFormat("en-NG");
export function formatCount(n: number): string {
  return numberFormat.format(n);
}

export function formatNaira(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `₦${(value / 1e9).toFixed(2)}bn`;
  if (abs >= 1e6) return `₦${(value / 1e6).toFixed(1)}m`;
  if (abs >= 1e3) return `₦${(value / 1e3).toFixed(1)}k`;
  return `₦${numberFormat.format(Math.round(value))}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `d MMM yyyy`, e.g. "6 Oct 2026". Accepts ISO dates or timestamps. */
export function formatMapDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatClock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function facilityAriaLabel(f: MapFacility): string {
  const tier = pinTier(f);
  const readiness =
    tier === "offline"
      ? "offline"
      : f.stockScorePercent != null && tier !== "none"
        ? `readiness ${f.stockScorePercent}%`
        : "no stock data";
  return `${f.name}, ${TYPE_LABELS[f.facilityType]}, ${readiness}`;
}

export function tooltipText(f: MapFacility): { name: string; detail: string; tier: PinTier } {
  const tier = pinTier(f);
  const detail =
    tier === "offline"
      ? "Offline"
      : tier === "none"
        ? "No data"
        : `${f.stockScorePercent}% ${READINESS_LABELS[tier]}`;
  return { name: f.name, detail, tier };
}

/** How pins are coloured: Asset Map uses readiness, the Facilities map uses status. */
export type PinMode = "readiness" | "status";

/** Status colouring: active facilities use the good token, inactive ones the offline grey. */
export function statusTier(f: MapFacility): PinTier {
  return f.isActive ? "good" : "offline";
}

export function pinTierFor(f: MapFacility, mode: PinMode = "readiness"): PinTier {
  return mode === "status" ? statusTier(f) : pinTier(f);
}

export function facilityAriaLabelFor(f: MapFacility, mode: PinMode = "readiness"): string {
  if (mode !== "status") return facilityAriaLabel(f);
  return `${f.name}, ${TYPE_LABELS[f.facilityType]}, ${f.isActive ? "active" : "inactive"}`;
}

export function tooltipTextFor(f: MapFacility, mode: PinMode = "readiness"): { name: string; detail: string; tier: PinTier } {
  if (mode !== "status") return tooltipText(f);
  return { name: f.name, detail: f.isActive ? "Active" : "Inactive", tier: statusTier(f) };
}

/** Bubble radius for the Assets layer: 4.5 + 1.45·√count px. */
export function bubbleRadius(count: number): number {
  return 4.5 + 1.45 * Math.sqrt(Math.max(0, count));
}
