import { describe, expect, it } from "vitest";
import { buildDistributionVelocity } from "./dashboard";
import { WAYBILL_DISTRIBUTION_DESTINATIONS } from "./distributionVelocity";

describe("distributionVelocity", () => {
  it("targets beneficiary and distribution_point destinations", () => {
    expect(WAYBILL_DISTRIBUTION_DESTINATIONS).toEqual(["beneficiary", "distribution_point"]);
  });

  it("builds KPI from aggregated totals (MV or join path)", () => {
    const velocity = buildDistributionVelocity({
      current: 140,
      previous: 100,
      historicalTotal: 500,
    });
    expect(velocity.value).toBe(140);
    expect(velocity.deltaPercent).toBe(40);
    expect(velocity.direction).toBe("up");
    expect(velocity.hasData).toBe(true);
  });

  it("hasData false when current and historical are zero", () => {
    const velocity = buildDistributionVelocity({
      current: 0,
      previous: 0,
      historicalTotal: 0,
    });
    expect(velocity.hasData).toBe(false);
  });
});
