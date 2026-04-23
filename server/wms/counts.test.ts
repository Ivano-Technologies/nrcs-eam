import { describe, expect, it } from "vitest";
import { computeCountVariance, validateRetroactiveCountEntry } from "./counts";

describe("counts variance migration helpers", () => {
  it("approve count with zero variance: no movement quantities", () => {
    const res = computeCountVariance(10, 10);
    expect(res.variance).toBe(0);
    expect(res.quantityIn).toBe(0);
    expect(res.quantityOut).toBe(0);
  });

  it("approve count with positive variance: quantity_in stock_check row semantics", () => {
    const res = computeCountVariance(10, 14);
    expect(res.variance).toBe(4);
    expect(res.quantityIn).toBe(4);
    expect(res.quantityOut).toBe(0);
  });

  it("approve count with negative variance: quantity_out stock_check row semantics", () => {
    const res = computeCountVariance(14, 9);
    expect(res.variance).toBe(-5);
    expect(res.quantityIn).toBe(0);
    expect(res.quantityOut).toBe(5);
  });

  it("retroactive entry without supervisor_id: rejected", () => {
    expect(() =>
      validateRetroactiveCountEntry({
        entryDateIso: "2026-04-20",
        todayIso: "2026-04-23",
      })
    ).toThrow(/supervisor_id/i);
  });

  it("retroactive entry with supervisor_id: accepted", () => {
    const res = validateRetroactiveCountEntry({
      entryDateIso: "2026-04-20",
      todayIso: "2026-04-23",
      supervisorId: 2,
    });
    expect(res.retroactive).toBe(true);
  });
});

