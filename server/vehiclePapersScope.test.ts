import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./complianceTrackingDb", async (orig) => {
  const actual = await orig<typeof import("./complianceTrackingDb")>();
  return {
    ...actual,
    listVehicleCompliance: vi.fn(async () => []),
    upsertVehicleCompliance: vi.fn(async () => 99),
    deleteVehicleCompliance: vi.fn(async () => undefined),
    // asset 10 and record 1 at facility 1; asset 20 and record 2 at facility 2
    getAssetSiteId: vi.fn(async (assetId: number) => ({ 10: 1, 20: 2 } as Record<number, number>)[assetId]),
    getVehicleComplianceSiteId: vi.fn(async (id: number) => ({ 1: 1, 2: 2 } as Record<number, number>)[id]),
  };
});

import * as complianceDb from "./complianceTrackingDb";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;
function caller(role: User["role"], siteId: number | null) {
  const user = {
    id: 1, openId: "t", authUserId: null, email: "u@nrcs.org", name: "U", loginMethod: "supabase",
    role, siteId, hasCompletedOnboarding: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  } as User;
  return appRouter.createCaller({ user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] })
    .complianceTracking.vehicles;
}
const FORBIDDEN = { code: "FORBIDDEN" };

beforeEach(() => vi.clearAllMocks());

describe("vehicle papers facility scope (IVA-160)", () => {
  it("scopes the list to the user's facility; admins see all", async () => {
    await caller("manager", 1).list({ status: "expiring" });
    expect(complianceDb.listVehicleCompliance).toHaveBeenLastCalledWith({ status: "expiring", siteId: 1 });
    await caller("staff", 2).list();
    expect(complianceDb.listVehicleCompliance).toHaveBeenLastCalledWith({ siteId: 2 });
    await caller("manager", null).list();
    expect(complianceDb.listVehicleCompliance).toHaveBeenLastCalledWith({ siteId: -1 });
    await caller("admin", 1).list();
    expect(complianceDb.listVehicleCompliance).toHaveBeenLastCalledWith({ siteId: undefined });
  });

  it("blocks a manager adding papers for a vehicle at another facility", async () => {
    await expect(caller("manager", 1).upsert({ assetId: 20 })).rejects.toMatchObject(FORBIDDEN);
    await expect(caller("manager", null).upsert({ assetId: 10 })).rejects.toMatchObject(FORBIDDEN);
    expect(complianceDb.upsertVehicleCompliance).not.toHaveBeenCalled();
    await expect(caller("manager", 1).upsert({ assetId: 10 })).resolves.toBe(99);
  });

  it("blocks a manager editing papers at another facility, including moving them in", async () => {
    await expect(caller("manager", 1).upsert({ id: 2, assetId: 20 })).rejects.toMatchObject(FORBIDDEN);
    await expect(caller("manager", 1).upsert({ id: 2, assetId: 10 })).rejects.toMatchObject(FORBIDDEN);
    await expect(caller("manager", 1).upsert({ id: 1, assetId: 20 })).rejects.toMatchObject(FORBIDDEN);
    expect(complianceDb.upsertVehicleCompliance).not.toHaveBeenCalled();
    await expect(caller("manager", 1).upsert({ id: 1, assetId: 10 })).resolves.toBe(99);
  });

  it("blocks a manager deleting papers at another facility", async () => {
    await expect(caller("manager", 1).delete({ id: 2 })).rejects.toMatchObject(FORBIDDEN);
    expect(complianceDb.deleteVehicleCompliance).not.toHaveBeenCalled();
    await caller("manager", 1).delete({ id: 1 });
    expect(complianceDb.deleteVehicleCompliance).toHaveBeenCalledWith(1);
  });

  it("lets admins write across facilities and reports missing records", async () => {
    await expect(caller("admin", 1).upsert({ id: 2, assetId: 20 })).resolves.toBe(99);
    await caller("admin", null).delete({ id: 2 });
    await expect(caller("admin", 1).delete({ id: 404 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller("admin", 1).upsert({ assetId: 404 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("still rejects staff writes by role", async () => {
    await expect(caller("staff", 1).delete({ id: 1 })).rejects.toMatchObject({ code: expect.stringMatching(/FORBIDDEN|UNAUTHORIZED/) });
  });
});
