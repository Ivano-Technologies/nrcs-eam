import { describe, expect, it, beforeEach } from "vitest";
import {
  getDashboardRequestStats,
  getLastDashboardRequests,
  recordDashboardRequest,
  resetDashboardRequestBufferMemory,
} from "../_core/dashboardRequestBuffer";

describe("dashboardRequestBuffer", () => {
  beforeEach(() => {
    resetDashboardRequestBufferMemory();
  });

  it("stores and returns recent dashboard requests", async () => {
    await recordDashboardRequest({
      source: "all",
      wallClockMs: 1200,
      tier1Ms: 400,
      tier2Ms: 400,
      tier3Ms: 400,
      timedOutSections: [],
      userId: "1",
      timestamp: new Date().toISOString(),
      loadingState: { tier1: "complete", tier2: "complete", tier3: "complete" },
    });
    await recordDashboardRequest({
      source: "byTier",
      wallClockMs: 5000,
      tier1Ms: 5000,
      tier2Ms: null,
      tier3Ms: null,
      timedOutSections: ["metrics"],
      userId: "2",
      timestamp: new Date().toISOString(),
      loadingState: { tier1: "timeout", tier2: "complete", tier3: "complete" },
    });

    const last = await getLastDashboardRequests(5);
    expect(last.length).toBe(2);
    expect(last[0]?.wallClockMs).toBe(5000);

    const stats = await getDashboardRequestStats();
    expect(stats.sampleSize).toBe(2);
    expect(stats.timeoutRatePct).toBeGreaterThan(0);
  });
});
