import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetUpstashWarnStateForTests, upstashFetch, upstashGet } from "../_core/upstashRedis";

describe("upstashFetch", () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    resetUpstashWarnStateForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    resetUpstashWarnStateForTests();
  });

  it("returns null when env vars are unset", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    await expect(upstashFetch("/ping")).resolves.toBeNull();
  });

  it("returns null and does not fetch when the URL has no http scheme", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "broken-upstash.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(upstashFetch("/ping")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null instead of throwing when fetch fails", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://127.0.0.1:9";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetch failed"));
    await expect(upstashFetch("/get/foo")).resolves.toBeNull();
    await expect(upstashGet("foo")).resolves.toBeNull();
  });
});
