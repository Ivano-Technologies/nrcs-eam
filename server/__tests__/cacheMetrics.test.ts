import { describe, expect, it, beforeEach } from "vitest";
import {
  cacheKeyToPrefix,
  getCacheMetrics,
  recordCacheHit,
  recordCacheMiss,
  resetCacheMetricsMemory,
} from "../_core/cacheMetrics";

describe("cacheMetrics", () => {
  beforeEach(() => {
    resetCacheMetricsMemory();
  });

  it("maps cache keys to prefixes", () => {
    expect(cacheKeyToPrefix("dashboard:metrics:all:Month")).toBe("metrics");
    expect(cacheKeyToPrefix("dashboard:totalAssetValue:all:all")).toBe("totalAssetValue");
    expect(cacheKeyToPrefix("sites:mapNetworkData:v1")).toBe("mapNetworkData");
    expect(cacheKeyToPrefix("other:key")).toBe("other");
  });

  it("tracks hits and misses in memory fallback", async () => {
    await recordCacheHit("dashboard:metrics:x");
    await recordCacheHit("dashboard:metrics:y");
    await recordCacheMiss("dashboard:metrics:z");

    const metrics = await getCacheMetrics();
    expect(metrics.hits).toBeGreaterThanOrEqual(2);
    expect(metrics.misses).toBeGreaterThanOrEqual(1);
    expect(metrics.totalGets).toBe(metrics.hits + metrics.misses);
    expect(metrics.byPrefix.metrics.hits).toBeGreaterThanOrEqual(2);
  });
});
