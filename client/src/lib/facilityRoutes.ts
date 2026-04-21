import {
  FACILITY_TYPE_LABELS,
  FACILITY_TYPE_VALUES,
  type FacilityType,
} from "@shared/facilities";

/** URL segment under `/app/facilities/...` (not including `all` for root redirect target). */
export type FacilitiesSegment = "all" | "national-hq" | "branches" | "clinics" | "warehouses";

export function segmentToListFilter(segment: FacilitiesSegment): FacilityType | undefined {
  if (segment === "all") return undefined;
  if (segment === "national-hq") return "division";
  if (segment === "branches") return "branch";
  if (segment === "clinics") return "clinic";
  return "warehouse";
}

/** Query param value for `/facilities/new?type=...` (matches stored enum values). */
export function segmentToNewTypeQuery(segment: FacilitiesSegment): string | undefined {
  return segmentToListFilter(segment);
}

/**
 * Parse `?type=` from the create URL. Accepts enum values, labels (e.g. "Warehouse", "Clinic"),
 * and common aliases for divisions (National HQ).
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
    return "division";
  }
  return undefined;
}
