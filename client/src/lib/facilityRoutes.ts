import {
  FACILITY_TYPE_LABELS,
  FACILITY_TYPE_VALUES,
  type FacilityType,
} from "@shared/facilities";

/** URL segment under `/app/facilities/...` (not including `all` for root redirect target). */
export type FacilitiesSegment =
  | "all"
  | "national-hq"
  | "branches"
  | "divisions"
  | "clinics"
  | "warehouses";

export function segmentToListFilter(segment: FacilitiesSegment): FacilityType | undefined {
  if (segment === "all") return undefined;
  if (segment === "national-hq") return "national_headquarters";
  if (segment === "branches") return "branch";
  if (segment === "divisions") return "division";
  if (segment === "clinics") return "clinic";
  return "warehouse";
}

/** Query param value for `/facilities/new?type=...` (matches stored enum values). */
export function segmentToNewTypeQuery(segment: FacilitiesSegment): string | undefined {
  return segmentToListFilter(segment);
}

/**
 * Parse `?type=` from the create URL. Accepts enum values, labels (e.g. "Warehouse", "Clinic"),
 * and common aliases for National HQ (national_headquarters).
 */
export function parseFacilityTypeFromSearch(search: string): FacilityType | undefined {
  const raw = new URLSearchParams(search).get("type")?.trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  const direct = FACILITY_TYPE_VALUES.find((v) => v === lower);
  if (direct) return direct;
  const byLabel = FACILITY_TYPE_VALUES.find(
    (v) => FACILITY_TYPE_LABELS[v].toLowerCase() === lower
  );
  if (byLabel) return byLabel;
  if (lower === "national hq" || lower === "national-hq" || lower === "headquarters" || lower === "hq") {
    return "national_headquarters";
  }
  return undefined;
}

/** Route segment for a type picked in the toolbar (the inverse of `segmentToListFilter`). */
export function typeToSegment(type: FacilityType | "all"): FacilitiesSegment {
  if (type === "all") return "all";
  if (type === "national_headquarters") return "national-hq";
  if (type === "branch") return "branches";
  if (type === "division") return "divisions";
  if (type === "clinic") return "clinics";
  return "warehouses";
}

/** Facilities list routes (the Table, Card and Map views live here; not /new or a detail page). */
const FACILITIES_LIST_PATH = /^\/app\/facilities(?:\/(?:all|national-hq|branches|divisions|clinics|warehouses))?\/?$/;

export function isFacilitiesListPath(pathname: string): boolean {
  return FACILITIES_LIST_PATH.test(pathname);
}

/** Saved view name for the Facilities list (`viewMode_v2_facilities`: table, card or map). */
export const FACILITIES_VIEW_NAME = "facilities";
export const FACILITIES_VIEWS = ["table", "card", "map"] as const;

/** True when the URL asks for the Map view (`?view=map`). */
export function isFacilitiesMapSearch(search: string): boolean {
  return new URLSearchParams(search).get("view") === "map";
}

/** The same path with `view` set to map, or removed. Other params (for example mapMock) are kept. */
export function withFacilitiesView(pathname: string, search: string, view: "map" | null): string {
  const params = new URLSearchParams(search);
  if (view) params.set("view", view);
  else params.delete("view");
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
