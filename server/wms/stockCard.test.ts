import { describe, expect, it } from "vitest";
import {
  buildRetroactiveStockCheckRemark,
  computeStockCheckMovement,
  requiresSupervisorForRetroactiveEntry,
} from "./stockCard";

describe("stock card stock-check computation", () => {
  it("addStockCheck with no discrepancy keeps balance unchanged", () => {
    const res = computeStockCheckMovement(25, 25);
    expect(res.variance).toBe(0);
    expect(res.quantityIn).toBe(0);
    expect(res.quantityOut).toBe(0);
    expect(res.balanceAfter).toBe(25);
  });

  it("addStockCheck with positive variance writes quantity_in", () => {
    const res = computeStockCheckMovement(12, 18);
    expect(res.variance).toBe(6);
    expect(res.quantityIn).toBe(6);
    expect(res.quantityOut).toBe(0);
    expect(res.balanceAfter).toBe(18);
  });

  it("addStockCheck with negative variance writes quantity_out", () => {
    const res = computeStockCheckMovement(18, 11);
    expect(res.variance).toBe(-7);
    expect(res.quantityIn).toBe(0);
    expect(res.quantityOut).toBe(7);
    expect(res.balanceAfter).toBe(11);
  });

  it("retroactive date requires supervisor", () => {
    expect(requiresSupervisorForRetroactiveEntry("2026-04-22", "2026-04-23")).toBe(true);
    expect(requiresSupervisorForRetroactiveEntry("2026-04-23", "2026-04-23")).toBe(false);
  });

  it("retroactive remark prepends actor and date", () => {
    const remark = buildRetroactiveStockCheckRemark({
      original: "Count sheet backfill",
      actorName: "Storekeeper A",
      todayIso: "2026-04-23",
    });
    expect(remark).toContain("Retroactively recorded by Storekeeper A on 2026-04-23");
    expect(remark).toContain("Count sheet backfill");
  });
});

