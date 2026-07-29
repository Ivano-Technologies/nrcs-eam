import { describe, expect, it } from "vitest";
import {
  SIDEBAR_BOTTOM,
  SIDEBAR_GROUPS,
  SIDEBAR_GROUPS_ADMIN,
  SIDEBAR_TOP,
  groupIdForPath,
} from "../config/appNav";
import { appPath } from "../lib/routes";

const PRIMARY = new Set(["assets", "facilities", "maintenance"]);

describe("TASK-7.A mobile bottom nav reachability", () => {
  it("maps every SIDEBAR_GROUPS leaf to a primary tab sheet or More", () => {
    const primaryLeaves: string[] = [];
    const moreLeaves: string[] = [];

    for (const g of SIDEBAR_GROUPS) {
      for (const item of g.items) {
        if (PRIMARY.has(g.id)) primaryLeaves.push(`${g.id}::${item.label}`);
        else moreLeaves.push(`${g.id}::${item.label}`);
      }
    }

    expect(primaryLeaves.length).toBeGreaterThan(0);
    expect(moreLeaves.length).toBeGreaterThan(0);
    expect(primaryLeaves.every((x) => PRIMARY.has(x.split("::")[0]!))).toBe(true);
    expect(moreLeaves.every((x) => !PRIMARY.has(x.split("::")[0]!))).toBe(true);

    // Inventory + Reports are the only non-primary SIDEBAR_GROUPS today
    expect(SIDEBAR_GROUPS.filter((g) => !PRIMARY.has(g.id)).map((g) => g.id)).toEqual([
      "inventory",
      "reports",
    ]);
  });

  it("keeps Dashboard in SIDEBAR_TOP and Settings in SIDEBAR_BOTTOM (More sheet)", () => {
    expect(SIDEBAR_TOP.map((i) => i.label)).toEqual(["Dashboard"]);
    expect(SIDEBAR_BOTTOM.map((i) => i.label)).toEqual(["Settings"]);
    expect(SIDEBAR_GROUPS_ADMIN.map((g) => g.id)).toEqual(["administration"]);
  });

  it("reuses groupIdForPath for active-tab groups", () => {
    expect(groupIdForPath(appPath("/assets"))).toBe("assets");
    expect(groupIdForPath(appPath("/asset-map"))).toBe("assets");
    expect(groupIdForPath(appPath("/facilities/all"))).toBe("facilities");
    expect(groupIdForPath(appPath("/work-orders"))).toBe("maintenance");
    expect(groupIdForPath(appPath("/fleet-health"))).toBe("maintenance");
    expect(groupIdForPath(appPath("/inventory/stock-overview"))).toBe("inventory");
    expect(groupIdForPath(appPath("/reports"))).toBe("reports");
    expect(groupIdForPath(appPath("/dashboard-settings"))).toBe("settings");
    expect(groupIdForPath(appPath("/"))).toBeNull();
  });
});
