import { describe, expect, it } from "vitest";
import {
  READINESS_LABELS,
  matchesStockTierForTest,
  pinTier,
  readinessTier,
  stockPinColorForTest,
} from "../../client/src/lib/facilityMapHelpers";

describe("facilityMapHelpers", () => {
  const base = {
    isActive: true,
    stockScorePercent: 80,
    totalCards: 10,
  };

  it("assigns green for good stock (75% and up)", () => {
    expect(stockPinColorForTest(base)).toBe("#15803D");
    expect(stockPinColorForTest({ ...base, stockScorePercent: 75 })).toBe("#15803D");
    expect(stockPinColorForTest(base, "dark")).toBe("#22A35A");
  });

  it("assigns amber for partial stock (50 to 74%)", () => {
    expect(stockPinColorForTest({ ...base, stockScorePercent: 60 })).toBe("#D97706");
    expect(stockPinColorForTest({ ...base, stockScorePercent: 74 })).toBe("#D97706");
  });

  it("assigns #B91C1C (not brand red) for low stock", () => {
    expect(stockPinColorForTest({ ...base, stockScorePercent: 30 })).toBe("#B91C1C");
    expect(stockPinColorForTest({ ...base, stockScorePercent: 30 })).not.toBe("#C8102E");
  });

  it("splits offline from no data", () => {
    expect(pinTier({ ...base, isActive: false })).toBe("offline");
    expect(pinTier({ ...base, stockScorePercent: null })).toBe("none");
    expect(stockPinColorForTest({ ...base, totalCards: 0 })).toBe("#878C95");
    expect(stockPinColorForTest({ ...base, isActive: false })).toBe("#6B7280");
  });

  it("uses Partial, not Watch, for the middle level", () => {
    expect(READINESS_LABELS.partial).toBe("Partial");
    expect(Object.values(READINESS_LABELS)).not.toContain("Watch");
  });

  it("filters stock tiers", () => {
    expect(matchesStockTierForTest(base, "good")).toBe(true);
    expect(matchesStockTierForTest({ ...base, stockScorePercent: 30 }, "low")).toBe(true);
    expect(matchesStockTierForTest({ ...base, stockScorePercent: 30 }, "good")).toBe(false);
    expect(matchesStockTierForTest({ ...base, isActive: false }, "none")).toBe(true);
    expect(readinessTier({ ...base, stockScorePercent: 55 })).toBe("partial");
  });
});
