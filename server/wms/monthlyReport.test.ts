import { describe, expect, it } from "vitest";
import { monthBounds } from "./monthlyWarehouseReport";

describe("monthly warehouse report helpers", () => {
  it("computes month boundaries in UTC", () => {
    const bounds = monthBounds(2026, 4);
    expect(bounds.startIso).toBe("2026-04-01");
    expect(bounds.endIso).toBe("2026-04-30");
  });

  it("supports leap-year February", () => {
    const bounds = monthBounds(2028, 2);
    expect(bounds.startIso).toBe("2028-02-01");
    expect(bounds.endIso).toBe("2028-02-29");
  });
});

