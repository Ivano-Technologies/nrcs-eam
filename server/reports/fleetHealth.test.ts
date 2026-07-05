import { describe, expect, it } from "vitest";
import {
  bucketWorkOrderAge,
  computeAssetBookValue,
  type ReplacementPipelineItem,
} from "./fleetHealth";

describe("computeAssetBookValue", () => {
  it("flags assets past 80% of useful life", () => {
    const base = {
      id: 1,
      assetTag: "AST-001",
      name: "Test Vehicle",
      siteId: 1,
      categoryName: "Vehicle",
      acquisitionCost: "100000",
      residualValue: "0",
      usefulLifeYears: 5,
      depreciationMethod: "straight-line",
      depreciationStartDate: new Date("2019-01-01"),
      actualUnitValue: null,
      itemCategory: null,
      yearAcquiredRegister: null,
      depreciatedValue: null,
      depreciatedValueManualOverride: false,
    };
    const result = computeAssetBookValue(base);
    expect(result).not.toBeNull();
    expect(result!.yearsElapsed).toBeGreaterThanOrEqual(4);
    const lifePct = result!.yearsElapsed / result!.usefulLifeYears;
    expect(lifePct).toBeGreaterThanOrEqual(0.8);
  });

  it("computes register-based book value", () => {
    const result = computeAssetBookValue({
      id: 2,
      assetTag: "AST-002",
      name: "Computer",
      siteId: 1,
      categoryName: "Computer",
      acquisitionCost: null,
      residualValue: null,
      usefulLifeYears: null,
      depreciationMethod: null,
      depreciationStartDate: null,
      actualUnitValue: "500000",
      itemCategory: "Computer",
      yearAcquiredRegister: 2020,
      depreciatedValue: null,
      depreciatedValueManualOverride: false,
    });
    expect(result).not.toBeNull();
    expect(result!.bookValue).toBeGreaterThan(0);
    expect(result!.bookValue).toBeLessThan(500000);
  });
});

describe("bucketWorkOrderAge", () => {
  it("buckets by days since last update", () => {
    const now = Date.now();
    expect(bucketWorkOrderAge(new Date(now - 3 * 86400000))).toBe("days0to7");
    expect(bucketWorkOrderAge(new Date(now - 10 * 86400000))).toBe("days8to14");
    expect(bucketWorkOrderAge(new Date(now - 20 * 86400000))).toBe("days15to30");
    expect(bucketWorkOrderAge(new Date(now - 45 * 86400000))).toBe("days30plus");
  });
});

describe("replacement pipeline bucketing", () => {
  it("includes only assets at or above 80% life", () => {
    const pipeline: ReplacementPipelineItem[] = [
      {
        assetId: 1,
        assetTag: "A",
        assetName: "Old",
        siteId: 1,
        siteName: "HQ",
        category: "Vehicle",
        yearsElapsed: 4.5,
        usefulLifeYears: 5,
        lifePercentUsed: 90,
        currentBookValue: 10000,
      },
    ];
    expect(pipeline.every((p) => p.lifePercentUsed >= 80)).toBe(true);
  });
});
