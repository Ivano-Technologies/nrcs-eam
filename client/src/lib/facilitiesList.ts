/**
 * Facilities page list helpers: the shared toolbar filters (type, state, status, search) and the
 * "N facilities · M on the map" count. Pure, so the Table, Card and Map views agree on one result.
 */
import type { FacilityType } from "@shared/facilities";

export type FacilityStatusFilter = "all" | "active" | "inactive";

export type FacilityListFilters = {
  type: FacilityType | "all";
  state: string;
  status: FacilityStatusFilter;
  q: string;
};

export type FacilityListRow = {
  id: number;
  code?: string | null;
  name: string;
  address?: string | null;
  facilityType: FacilityType;
  state?: string | null;
  isActive: boolean;
  latitude?: string | number | null;
  longitude?: string | number | null;
};

function coord(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** A facility is on the map when both coordinates are real numbers. */
export function siteHasLocation(row: Pick<FacilityListRow, "latitude" | "longitude">): boolean {
  const lat = coord(row.latitude);
  const lng = coord(row.longitude);
  return lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function filterFacilityRows<T extends FacilityListRow>(rows: readonly T[], f: FacilityListFilters): T[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.type !== "all" && r.facilityType !== f.type) return false;
    if (f.status === "active" && !r.isActive) return false;
    if (f.status === "inactive" && r.isActive) return false;
    if (f.state !== "all" && (r.state ?? "") !== f.state) return false;
    if (!q) return true;
    return `${r.code ?? ""} ${r.name} ${r.address ?? ""}`.toLowerCase().includes(q);
  });
}

export type FacilityCounts = { total: number; onMap: number; noLocation: number };

export function facilityCounts(rows: readonly Pick<FacilityListRow, "latitude" | "longitude">[]): FacilityCounts {
  const onMap = rows.filter(siteHasLocation).length;
  return { total: rows.length, onMap, noLocation: rows.length - onMap };
}

export function countLine(c: Pick<FacilityCounts, "total" | "onMap">): string {
  return `${c.total} ${c.total === 1 ? "facility" : "facilities"} · ${c.onMap} on the map`;
}
