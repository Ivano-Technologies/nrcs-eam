import { describe, expect, it } from "vitest";
import {
  ASSET_REGISTER_URL_DEFAULTS,
  buildAssetRegisterSearch,
  parseAssetRegisterSearch,
  sameAssetRegisterState,
} from "./assetRegisterUrlState";

describe("parseAssetRegisterSearch", () => {
  it("returns defaults for an empty query", () => {
    expect(parseAssetRegisterSearch("")).toEqual(ASSET_REGISTER_URL_DEFAULTS);
    expect(parseAssetRegisterSearch("?")).toEqual(ASSET_REGISTER_URL_DEFAULTS);
  });

  it("reads every supported filter", () => {
    const s = parseAssetRegisterSearch(
      "?q=laptop&status=in_store&category=4,2&siteId=7&type=inventory&sort=name&dir=asc&page=3&pageSize=100"
    );
    expect(s).toEqual({
      search: "laptop",
      status: "in_store",
      category: "2,4",
      site: "7",
      itemType: "inventory",
      sortBy: "name",
      sortDir: "asc",
      page: 2,
      pageSize: "100",
    });
  });

  it("keeps the legacy siteId deep link working", () => {
    expect(parseAssetRegisterSearch("siteId=12").site).toBe("12");
  });

  it("drops invalid values back to defaults", () => {
    const s = parseAssetRegisterSearch(
      "status=bogus&category=a,-1,0&siteId=abc&type=car&sort=drop_table&dir=up&page=0&pageSize=7"
    );
    expect(s).toEqual(ASSET_REGISTER_URL_DEFAULTS);
  });

  it("dedupes and sorts category ids", () => {
    expect(parseAssetRegisterSearch("category=9,3,9, 1").category).toBe("1,3,9");
  });
});

describe("buildAssetRegisterSearch", () => {
  it("omits defaults", () => {
    expect(buildAssetRegisterSearch(ASSET_REGISTER_URL_DEFAULTS)).toBe("");
  });

  it("writes non-default values with a one-based page", () => {
    const qs = buildAssetRegisterSearch({
      ...ASSET_REGISTER_URL_DEFAULTS,
      search: "dell xps",
      status: "under_maintenance",
      site: "5",
      page: 1,
      pageSize: "all",
    });
    const p = new URLSearchParams(qs);
    expect(p.get("q")).toBe("dell xps");
    expect(p.get("status")).toBe("under_maintenance");
    expect(p.get("siteId")).toBe("5");
    expect(p.get("page")).toBe("2");
    expect(p.get("pageSize")).toBe("all");
    expect(p.has("sort")).toBe(false);
  });

  it("preserves unrelated params and removes cleared filters", () => {
    const qs = buildAssetRegisterSearch(ASSET_REGISTER_URL_DEFAULTS, "?status=in_use&utm=x&siteId=3");
    expect(qs).toBe("utm=x");
  });

  it("does not persist whitespace-only search", () => {
    expect(buildAssetRegisterSearch({ ...ASSET_REGISTER_URL_DEFAULTS, search: "   " })).toBe("");
  });

  it("round-trips through parse", () => {
    const state = {
      ...ASSET_REGISTER_URL_DEFAULTS,
      search: "a&b=c",
      category: "1,2",
      itemType: "asset",
      sortBy: "siteName" as const,
      sortDir: "asc" as const,
      page: 4,
    };
    expect(sameAssetRegisterState(parseAssetRegisterSearch(buildAssetRegisterSearch(state)), state)).toBe(true);
  });
});
