import { describe, expect, it } from "vitest";
import { countLine, facilityCounts, filterFacilityRows, siteHasLocation, type FacilityListRow } from "./facilitiesList";

const ROWS: FacilityListRow[] = [
  { id: 1, code: "NHQ-001", name: "National Headquarters", address: "Plot 1 Abuja", facilityType: "national_headquarters", state: "FCT", isActive: true, latitude: "9.05", longitude: "7.49" },
  { id: 2, code: "KAN-001", name: "Kano State Branch", address: "Kano", facilityType: "branch", state: "Kano", isActive: true, latitude: "12", longitude: "8.5" },
  { id: 3, code: "BOR-001", name: "Borno State Branch", address: null, facilityType: "branch", state: "Borno", isActive: false, latitude: "11.8", longitude: "13.1" },
  { id: 4, code: "WH-009", name: "Unmapped Warehouse", address: "Ibadan", facilityType: "warehouse", state: "Oyo", isActive: true, latitude: null, longitude: null },
  { id: 5, code: null, name: "Bad Coords Clinic", address: "", facilityType: "clinic", state: "Kano", isActive: false, latitude: "abc", longitude: "3.4" },
];
const ALL = { type: "all" as const, state: "all", status: "all" as const, q: "" };
const ids = (rows: FacilityListRow[]) => rows.map((r) => r.id);

describe("Facilities toolbar filters", () => {
  it("returns every facility with no filters", () => {
    expect(ids(filterFacilityRows(ROWS, ALL))).toEqual([1, 2, 3, 4, 5]);
  });

  it("filters by type, state and status, and combines them", () => {
    expect(ids(filterFacilityRows(ROWS, { ...ALL, type: "branch" }))).toEqual([2, 3]);
    expect(ids(filterFacilityRows(ROWS, { ...ALL, state: "Kano" }))).toEqual([2, 5]);
    expect(ids(filterFacilityRows(ROWS, { ...ALL, status: "inactive" }))).toEqual([3, 5]);
    expect(ids(filterFacilityRows(ROWS, { ...ALL, status: "active" }))).toEqual([1, 2, 4]);
    expect(ids(filterFacilityRows(ROWS, { type: "branch", state: "Kano", status: "active", q: "" }))).toEqual([2]);
    expect(ids(filterFacilityRows(ROWS, { type: "clinic", state: "Kano", status: "active", q: "" }))).toEqual([]);
  });

  it("searches name, code and address, ignoring case and spaces", () => {
    expect(ids(filterFacilityRows(ROWS, { ...ALL, q: "  kan-001 " }))).toEqual([2]);
    expect(ids(filterFacilityRows(ROWS, { ...ALL, q: "borno" }))).toEqual([3]);
    expect(ids(filterFacilityRows(ROWS, { ...ALL, q: "ibadan" }))).toEqual([4]);
    expect(ids(filterFacilityRows(ROWS, { ...ALL, type: "branch", q: "ibadan" }))).toEqual([]);
  });
});

describe("No location count", () => {
  it("counts facilities without usable coordinates", () => {
    expect(siteHasLocation(ROWS[0])).toBe(true);
    expect(siteHasLocation(ROWS[3])).toBe(false);
    expect(siteHasLocation(ROWS[4])).toBe(false);
    expect(siteHasLocation({ latitude: "95", longitude: "7" })).toBe(false);
    expect(siteHasLocation({ latitude: 0, longitude: 0 })).toBe(true);
    expect(facilityCounts(ROWS)).toEqual({ total: 5, onMap: 3, noLocation: 2 });
  });

  it("follows the toolbar filters", () => {
    expect(facilityCounts(filterFacilityRows(ROWS, { ...ALL, state: "Kano" }))).toEqual({ total: 2, onMap: 1, noLocation: 1 });
    expect(facilityCounts(filterFacilityRows(ROWS, { ...ALL, type: "branch" }))).toEqual({ total: 2, onMap: 2, noLocation: 0 });
  });

  it("writes the count line without hyphens", () => {
    expect(countLine({ total: 12, onMap: 10 })).toBe("12 facilities · 10 on the map");
    expect(countLine({ total: 1, onMap: 0 })).toBe("1 facility · 0 on the map");
  });
});
