import { describe, expect, it } from "vitest";
import { SIDEBAR_FULL_WIDTH, SIDEBAR_RAIL_WIDTH, snapSidebarWidth } from "./sidebarWidth";

describe("snapSidebarWidth (Wave B13)", () => {
  it("only ever returns 256 or 64", () => {
    expect(SIDEBAR_FULL_WIDTH).toBe(256);
    expect(SIDEBAR_RAIL_WIDTH).toBe(64);
    for (let w = 0; w <= 600; w += 7) {
      expect([256, 64]).toContain(snapSidebarWidth(w));
    }
  });

  it("snaps legacy saved widths", () => {
    expect(snapSidebarWidth(80)).toBe(64);
    expect(snapSidebarWidth(140)).toBe(64);
    expect(snapSidebarWidth(200)).toBe(256);
    expect(snapSidebarWidth(280)).toBe(256);
    expect(snapSidebarWidth(360)).toBe(256);
  });

  it("defaults to the full width when nothing is saved", () => {
    expect(snapSidebarWidth(null)).toBe(256);
    expect(snapSidebarWidth(undefined)).toBe(256);
    expect(snapSidebarWidth(Number.NaN)).toBe(256);
  });
});
