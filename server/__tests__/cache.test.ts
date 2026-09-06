import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheGet,
  cacheSet,
  resetCacheMemoryForTests,
  withDashboardCache,
} from "../_core/cache";
import { resetUpstashWarnStateForTests } from "../_core/upstashRedis";

describe("cache fallback", () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    resetCacheMemoryForTests();
    resetUpstashWarnStateForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    resetCacheMemoryForTests();
    resetUpstashWarnStateForTests();
  });

  it("falls back to in-process memory when Upstash is unset", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    await cacheSet("k", "v", 60);
    await expect(cacheGet("k")).resolves.toBe("v");
  });

  it("withDashboardCache returns the computed value when Upstash throws", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://127.0.0.1:9";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetch failed"));

    const result = await withDashboardCache("dash:test", 60, async () => ({ n: 70 }));
    expect(result).toEqual({ n: 70 });
  });
});
