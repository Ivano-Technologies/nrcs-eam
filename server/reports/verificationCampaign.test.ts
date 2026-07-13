import { describe, expect, it } from "vitest";

describe("verification campaign progress math", () => {
  it("computes percent complete from verified and total", () => {
    const totalAssets = 40;
    const totalVerified = 30;
    const percent = totalAssets > 0 ? Math.round((totalVerified / totalAssets) * 1000) / 10 : 0;
    expect(percent).toBe(75);
  });

  it("flags discrepancy when verified site differs from registered site", () => {
    const registeredSiteId = 1;
    const verifiedSiteId = 2;
    expect(registeredSiteId !== verifiedSiteId).toBe(true);
  });
});
