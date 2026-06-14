import { describe, expect, it } from "vitest";
import {
  matchesStockTierForTest,
  stockPinColorForTest,
} from "../../client/src/lib/facilityMapHelpers";

describe("facilityMapHelpers", () => {
  const base = {
    isActive: true,
    stockScorePercent: 80,
    totalCards: 10,
  };

  it("assigns green for adequate stock", () => {
    expect(stockPinColorForTest(base)).toBe("#16A34A");
  });

  it("assigns yellow for partial stock", () => {
    expect(stockPinColorForTest({ ...base, stockScorePercent: 60 })).toBe("#EAB308");
  });

  it("assigns red for low stock", () => {
    expect(stockPinColorForTest({ ...base, stockScorePercent: 30 })).toBe("#DC2626");
  });

  it("filters stock tiers", () => {
    expect(matchesStockTierForTest(base, "adequate")).toBe(true);
    expect(matchesStockTierForTest({ ...base, stockScorePercent: 30 }, "low")).toBe(true);
    expect(matchesStockTierForTest({ ...base, stockScorePercent: 30 }, "adequate")).toBe(false);
  });
});
