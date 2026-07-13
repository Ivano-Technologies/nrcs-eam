import { describe, expect, it } from "vitest";
import { BRANCH_SCORECARD_WEIGHTS, computeCompositeScore } from "./branchScorecards";

describe("computeCompositeScore", () => {
  it("returns high score when all metrics are healthy", () => {
    const score = computeCompositeScore({
      verificationPercent: 100,
      overdueWorkOrders: 0,
      openWorkOrders: 5,
      stockAlerts: 0,
      expiryExposure30Day: 0,
      endOfLifeCount: 0,
      assetCount: 50,
    });
    expect(score).toBeGreaterThanOrEqual(95);
  });

  it("penalizes overdue work orders and stock alerts", () => {
    const healthy = computeCompositeScore({
      verificationPercent: 80,
      overdueWorkOrders: 0,
      openWorkOrders: 10,
      stockAlerts: 0,
      expiryExposure30Day: 10,
      endOfLifeCount: 2,
      assetCount: 20,
    });
    const stressed = computeCompositeScore({
      verificationPercent: 80,
      overdueWorkOrders: 8,
      openWorkOrders: 10,
      stockAlerts: 12,
      expiryExposure30Day: 200,
      endOfLifeCount: 10,
      assetCount: 20,
    });
    expect(stressed).toBeLessThan(healthy);
  });

  it("uses documented weights summing to 1", () => {
    const sum = Object.values(BRANCH_SCORECARD_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});
