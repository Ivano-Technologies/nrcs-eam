import { describe, expect, it } from "vitest";
import { buildDistributionVelocity, buildStockReadiness, directionFromDelta, percentDelta, stockReadinessTone } from "./dashboard";

describe("dashboard KPI helpers", () => {
  it("stockReadiness tone thresholds are correct", () => {
    expect(stockReadinessTone(8, 10)).toBe("green");
    expect(stockReadinessTone(5, 10)).toBe("amber");
    expect(stockReadinessTone(4, 10)).toBe("red");
  });

  it("distributionVelocity hasData=false when no data", () => {
    const velocity = buildDistributionVelocity({ current: 0, previous: 0, historicalTotal: 0 });
    expect(velocity.value).toBe(0);
    expect(velocity.hasData).toBe(false);
  });

  it("distributionVelocity percentage and direction use current vs previous", () => {
    const velocity = buildDistributionVelocity({ current: 140, previous: 100, historicalTotal: 250 });
    expect(velocity.value).toBe(140);
    expect(velocity.deltaPercent).toBe(40);
    expect(velocity.direction).toBe("up");
  });

  it("stockReadiness returns expected direction from adequate delta", () => {
    const readiness = buildStockReadiness({ adequate: 31, total: 37, previousAdequate: 29 });
    expect(readiness.adequate).toBe(31);
    expect(readiness.total).toBe(37);
    expect(readiness.delta).toBe(2);
    expect(readiness.direction).toBe("up");
    expect(readiness.tone).toBe("green");
  });

  it("utility functions remain stable", () => {
    expect(percentDelta(50, 0)).toBe(100);
    expect(directionFromDelta(0)).toBe("flat");
  });
});

