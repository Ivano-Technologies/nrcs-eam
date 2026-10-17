import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./complianceTrackingDb", async (orig) => {
  const actual = await orig<typeof import("./complianceTrackingDb")>();
  return { ...actual, getComplianceSummary: vi.fn(async () => ({ totalRecords: 0, compliantCount: 0, compliantPct: 0, expiringSoonCount: 0, nonCompliantCount: 0 })) };
});

import * as complianceDb from "./complianceTrackingDb";
import { scopeComplianceRecords } from "./complianceTrackingDb";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;
function summary(role: User["role"], siteId: number | null) {
  const user = {
    id: 1, openId: "t", authUserId: null, email: "u@nrcs.org", name: "U", loginMethod: "supabase",
    role, siteId, hasCompletedOnboarding: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  } as User;
  return appRouter
    .createCaller({ user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] })
    .complianceTracking.summary();
}

beforeEach(() => vi.clearAllMocks());

describe("compliance summary scope (IVA-169)", () => {
  it("gives admins org-wide counts and scopes everyone else to their facility", async () => {
    await summary("admin", 3);
    expect(complianceDb.getComplianceSummary).toHaveBeenLastCalledWith(undefined);
    for (const role of ["manager", "staff", "field"] as const) {
      await summary(role, 3);
      expect(complianceDb.getComplianceSummary).toHaveBeenLastCalledWith({ siteId: 3 });
    }
    await summary("manager", null);
    expect(complianceDb.getComplianceSummary).toHaveBeenLastCalledWith({ siteId: null });
  });
});

describe("scopeComplianceRecords", () => {
  const rec = <T>(o: T) => o as never;
  const records = {
    vehicles: [rec({ id: 1, assetId: 10 }), rec({ id: 2, assetId: 20 })],
    generators: [rec({ id: 3, assetId: 20 }), rec({ id: 4, assetId: 11 })],
    buildings: [rec({ id: 5, siteId: 1 }), rec({ id: 6, siteId: 2 })],
    donors: [
      rec({ id: 7, siteId: 1, assetId: 20 }), // own facility wins over the asset's
      rec({ id: 8, siteId: 2, assetId: 10 }),
      rec({ id: 9, siteId: null, assetId: 11 }), // falls back to the asset's facility
      rec({ id: 10, siteId: null, assetId: 20 }),
      rec({ id: 11, siteId: null, assetId: null }),
    ],
  };

  it("keeps only records at the facility", () => {
    const out = scopeComplianceRecords(records as never, 1, new Set([10, 11]));
    const ids = (xs: { id: number }[]) => xs.map((x) => x.id);
    expect(ids(out.vehicles as never)).toEqual([1]);
    expect(ids(out.generators as never)).toEqual([4]);
    expect(ids(out.buildings as never)).toEqual([5]);
    expect(ids(out.donors as never)).toEqual([7, 9]);
  });
});

describe("getComplianceSummary with no facility", () => {
  it("returns zeros without querying", async () => {
    const actual = await vi.importActual<typeof import("./complianceTrackingDb")>("./complianceTrackingDb");
    await expect(actual.getComplianceSummary({ siteId: null })).resolves.toEqual({
      totalRecords: 0, compliantCount: 0, compliantPct: 0, expiringSoonCount: 0, nonCompliantCount: 0, noDateCount: 0,
    });
  });
});
