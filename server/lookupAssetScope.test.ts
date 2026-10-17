import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./complianceTrackingDb", async (orig) => ({
  ...(await orig<typeof import("./complianceTrackingDb")>()),
  lookupAssetByCode: vi.fn(async () => null),
}));

import * as complianceDb from "./complianceTrackingDb";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;
function lookup(role: User["role"], siteId: number | null, assetCode: string) {
  const user = {
    id: 1, openId: "t", authUserId: null, email: "u@nrcs.org", name: "U", loginMethod: "supabase",
    role, siteId, hasCompletedOnboarding: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  } as User;
  return appRouter
    .createCaller({ user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] })
    .complianceTracking.lookupAsset({ assetCode });
}

beforeEach(() => vi.clearAllMocks());

describe("complianceTracking.lookupAsset facility scope (IVA-170)", () => {
  it("admins look up across facilities", async () => {
    await lookup("admin", null, " NRCS_ABJVE0001 ");
    expect(complianceDb.lookupAssetByCode).toHaveBeenLastCalledWith("NRCS_ABJVE0001", { siteId: undefined });
  });

  it("managers and staff only find assets at their facility", async () => {
    await lookup("manager", 1, "NRCS_ABJVE0001");
    expect(complianceDb.lookupAssetByCode).toHaveBeenLastCalledWith("NRCS_ABJVE0001", { siteId: 1 });
    await lookup("staff", 2, "NRCS_ABJVE0001");
    expect(complianceDb.lookupAssetByCode).toHaveBeenLastCalledWith("NRCS_ABJVE0001", { siteId: 2 });
  });

  it("users without a facility find nothing", async () => {
    await lookup("manager", null, "NRCS_ABJVE0001");
    expect(complianceDb.lookupAssetByCode).toHaveBeenLastCalledWith("NRCS_ABJVE0001", { siteId: -1 });
  });
});
