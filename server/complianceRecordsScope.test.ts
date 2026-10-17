import { beforeEach, describe, expect, it, vi } from "vitest";

// Facility 1: asset 10, generator record 1, building cert 1, donor report 1 (own facility) and 3 (via asset 10).
// Facility 2: asset 20, generator record 2, building cert 2, donor report 2. Donor report 4 has no facility.
vi.mock("./complianceTrackingDb", async (orig) => {
  const actual = await orig<typeof import("./complianceTrackingDb")>();
  const map = (m: Record<number, number | null>) => vi.fn(async (id: number) => (id in m ? m[id] : undefined));
  return {
    ...actual,
    listGeneratorCompliance: vi.fn(async () => []),
    listBuildingSafety: vi.fn(async () => []),
    listDonorReporting: vi.fn(async () => []),
    upsertGeneratorCompliance: vi.fn(async () => 99),
    upsertBuildingSafety: vi.fn(async () => 99),
    upsertDonorReporting: vi.fn(async () => 99),
    deleteGeneratorCompliance: vi.fn(async () => undefined),
    deleteBuildingSafety: vi.fn(async () => undefined),
    deleteDonorReporting: vi.fn(async () => undefined),
    getAssetSiteId: map({ 10: 1, 20: 2 }),
    getGeneratorComplianceSiteId: map({ 1: 1, 2: 2 }),
    getBuildingSafetySiteId: map({ 1: 1, 2: 2 }),
    getDonorReportingSiteId: map({ 1: 1, 2: 2, 3: 1, 4: null }),
  };
});

import * as complianceDb from "./complianceTrackingDb";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;
function api(role: User["role"], siteId: number | null) {
  const user = {
    id: 1, openId: "t", authUserId: null, email: "u@nrcs.org", name: "U", loginMethod: "supabase",
    role, siteId, hasCompletedOnboarding: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  } as User;
  return appRouter.createCaller({ user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] })
    .complianceTracking;
}
const FORBIDDEN = { code: "FORBIDDEN" };
const managerA = () => api("manager", 1);
const managerB = () => api("manager", 2);
const admin = () => api("admin", null);

beforeEach(() => vi.clearAllMocks());

describe("compliance lists are facility-scoped (IVA-172)", () => {
  it.each([
    ["generators", "listGeneratorCompliance"],
    ["buildings", "listBuildingSafety"],
    ["donor", "listDonorReporting"],
  ] as const)("%s list: own facility for non-admins, all for admins", async (router, fn) => {
    const list = (c: ReturnType<typeof api>) => (c[router] as { list: (i?: object) => Promise<unknown> }).list;
    await list(managerA())({});
    expect(complianceDb[fn]).toHaveBeenLastCalledWith({ siteId: 1 });
    await list(managerB())();
    expect(complianceDb[fn]).toHaveBeenLastCalledWith({ siteId: 2 });
    await list(api("staff", null))();
    expect(complianceDb[fn]).toHaveBeenLastCalledWith({ siteId: -1 });
    await list(admin())();
    expect(complianceDb[fn]).toHaveBeenLastCalledWith({ siteId: undefined });
  });
});

describe("generator records (IVA-172)", () => {
  it("blocks cross-facility add, edit and delete for managers", async () => {
    await expect(managerA().generators.upsert({ assetId: 20 })).rejects.toMatchObject(FORBIDDEN);
    await expect(managerA().generators.upsert({ id: 2, assetId: 20 })).rejects.toMatchObject(FORBIDDEN);
    await expect(managerA().generators.upsert({ id: 2, assetId: 10 })).rejects.toMatchObject(FORBIDDEN);
    await expect(managerA().generators.upsert({ id: 1, assetId: 20 })).rejects.toMatchObject(FORBIDDEN);
    await expect(managerA().generators.delete({ id: 2 })).rejects.toMatchObject(FORBIDDEN);
    expect(complianceDb.upsertGeneratorCompliance).not.toHaveBeenCalled();
    expect(complianceDb.deleteGeneratorCompliance).not.toHaveBeenCalled();
  });

  it("allows own-facility writes and admin writes anywhere", async () => {
    await expect(managerA().generators.upsert({ id: 1, assetId: 10 })).resolves.toBe(99);
    await managerB().generators.delete({ id: 2 });
    await expect(admin().generators.upsert({ id: 2, assetId: 20 })).resolves.toBe(99);
    await admin().generators.delete({ id: 1 });
    await expect(admin().generators.delete({ id: 404 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("building certificates (IVA-172)", () => {
  const cert = { certificateType: "Fire safety" };
  it("blocks cross-facility add, edit and delete for managers", async () => {
    await expect(managerA().buildings.upsert({ ...cert, siteId: 2 })).rejects.toMatchObject(FORBIDDEN);
    await expect(managerA().buildings.upsert({ ...cert, id: 2, siteId: 1 })).rejects.toMatchObject(FORBIDDEN);
    await expect(managerA().buildings.upsert({ ...cert, id: 1, siteId: 2 })).rejects.toMatchObject(FORBIDDEN);
    await expect(managerB().buildings.delete({ id: 1 })).rejects.toMatchObject(FORBIDDEN);
    await expect(api("manager", null).buildings.upsert({ ...cert, siteId: 1 })).rejects.toMatchObject(FORBIDDEN);
    expect(complianceDb.upsertBuildingSafety).not.toHaveBeenCalled();
    expect(complianceDb.deleteBuildingSafety).not.toHaveBeenCalled();
  });

  it("allows own-facility writes and admin writes anywhere", async () => {
    await expect(managerA().buildings.upsert({ ...cert, siteId: 1 })).resolves.toBe(99);
    await managerA().buildings.delete({ id: 1 });
    await expect(admin().buildings.upsert({ ...cert, id: 2, siteId: 1 })).resolves.toBe(99);
  });
});

describe("donor reports (IVA-172)", () => {
  const report = { donorName: "IFRC", reportType: "Quarterly", dueDate: "2026-12-31" };
  it("blocks cross-facility add, edit and delete for managers", async () => {
    await expect(managerA().donor.upsert({ ...report, siteId: 2 })).rejects.toMatchObject(FORBIDDEN);
    await expect(managerA().donor.upsert({ ...report, assetId: 20 })).rejects.toMatchObject(FORBIDDEN);
    await expect(managerA().donor.upsert({ ...report, siteId: 1, assetId: 20 })).rejects.toMatchObject(FORBIDDEN);
    await expect(managerA().donor.upsert({ ...report })).rejects.toMatchObject(FORBIDDEN); // no facility: admin only
    await expect(managerA().donor.upsert({ ...report, id: 2, siteId: 1 })).rejects.toMatchObject(FORBIDDEN);
    await expect(managerA().donor.upsert({ ...report, id: 4, siteId: 1 })).rejects.toMatchObject(FORBIDDEN);
    await expect(managerB().donor.delete({ id: 3 })).rejects.toMatchObject(FORBIDDEN); // facility via asset
    await expect(managerA().donor.delete({ id: 4 })).rejects.toMatchObject(FORBIDDEN);
    expect(complianceDb.upsertDonorReporting).not.toHaveBeenCalled();
    expect(complianceDb.deleteDonorReporting).not.toHaveBeenCalled();
  });

  it("allows own-facility writes and admin writes anywhere", async () => {
    await expect(managerA().donor.upsert({ ...report, siteId: 1 })).resolves.toBe(99);
    await expect(managerA().donor.upsert({ ...report, id: 3, assetId: 10 })).resolves.toBe(99);
    await managerA().donor.delete({ id: 3 });
    await expect(admin().donor.upsert({ ...report })).resolves.toBe(99);
    await admin().donor.delete({ id: 4 });
  });
});

describe("staff still blocked by role", () => {
  it("rejects staff writes", async () => {
    await expect(api("staff", 1).generators.delete({ id: 1 })).rejects.toMatchObject({ code: expect.stringMatching(/FORBIDDEN|UNAUTHORIZED/) });
  });
});
