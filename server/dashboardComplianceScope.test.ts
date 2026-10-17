import { beforeEach, describe, expect, it, vi } from "vitest";

// Fake DB: every query chain resolves to [] so only the compliance counts matter. The root is not
// thenable (getDb is awaited); chains returned from calls are.
const chain: unknown = new Proxy(function () {}, {
  get: (_t, prop) => (prop === "then" ? (resolve: (v: unknown[]) => void) => resolve([]) : chain),
  apply: () => chain,
});
const fakeDb = new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : chain) });

vi.mock("./db", async (orig) => ({ ...(await orig<typeof import("./db")>()), getDb: vi.fn(async () => fakeDb) }));
vi.mock("./_core/cache", async (orig) => ({
  ...(await orig<typeof import("./_core/cache")>()),
  withDashboardCache: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
}));
vi.mock("./complianceTrackingDb", async (orig) => ({
  ...(await orig<typeof import("./complianceTrackingDb")>()),
  countVehiclesExpiringSoon: vi.fn(async () => 2),
  countGeneratorsOverdue: vi.fn(async () => 1),
  countDonorReportsDueSoon: vi.fn(async () => 3),
}));
vi.mock("./financeModulesDb", async (orig) => ({
  ...(await orig<typeof import("./financeModulesDb")>()),
  countInsuranceExpiringSoon: vi.fn(async () => 0),
}));

import * as cache from "./_core/cache";
import * as complianceDb from "./complianceTrackingDb";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;
function caller(role: User["role"], siteId: number | null) {
  const user = {
    id: 1, openId: "t", authUserId: null, email: "u@nrcs.org", name: "U", loginMethod: "supabase",
    role, siteId, hasCompletedOnboarding: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  } as User;
  return appRouter.createCaller({ user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] });
}

beforeEach(() => vi.clearAllMocks());

describe("complianceCountScope (IVA-174)", () => {
  it("is org-wide for admins, own facility otherwise, null without a facility", async () => {
    const actual = await vi.importActual<typeof import("./complianceTrackingDb")>("./complianceTrackingDb");
    expect(actual.complianceCountScope({ role: "admin", siteId: 3 })).toBeUndefined();
    expect(actual.complianceCountScope({ role: "manager", siteId: 3 })).toEqual({ siteId: 3 });
    expect(actual.complianceCountScope({ role: "staff", siteId: 4 })).toEqual({ siteId: 4 });
    expect(actual.complianceCountScope({ role: "manager", siteId: null })).toEqual({ siteId: null });
  });

  it("counts zero without a facility, without querying", async () => {
    const actual = await vi.importActual<typeof import("./complianceTrackingDb")>("./complianceTrackingDb");
    await expect(actual.countVehiclesExpiringSoon({ siteId: null })).resolves.toBe(0);
    await expect(actual.countGeneratorsOverdue({ siteId: null })).resolves.toBe(0);
    await expect(actual.countDonorReportsDueSoon({ siteId: null })).resolves.toBe(0);
  });
});

describe("dashboard attention items compliance counts (IVA-174)", () => {
  const counts = [complianceDb.countVehiclesExpiringSoon, complianceDb.countGeneratorsOverdue, complianceDb.countDonorReportsDueSoon];
  const lastKey = () => vi.mocked(cache.withDashboardCache).mock.calls.at(-1)?.[0];

  it.each(["Admin", "Manager"] as const)("admin user gets org-wide counts (%s view)", async (view) => {
    const items = await caller("admin", null).dashboard.attentionItems({ role: view });
    for (const c of counts) expect(c).toHaveBeenLastCalledWith(undefined);
    expect(lastKey()).toContain(":call:");
    if (view === "Admin") expect(items.map((i) => i.label).join(" ")).toMatch(/2 vehicles/);
  });

  it.each(["Admin", "Manager"] as const)("manager user gets facility counts (%s view)", async (view) => {
    await caller("manager", 7).dashboard.attentionItems({ role: view });
    for (const c of counts) expect(c).toHaveBeenLastCalledWith({ siteId: 7 });
    expect(lastKey()).toContain(":c7:");
  });

  it("manager without a facility counts nothing", async () => {
    await caller("manager", null).dashboard.attentionItems({ role: "Manager" });
    for (const c of counts) expect(c).toHaveBeenLastCalledWith({ siteId: null });
    expect(lastKey()).toContain(":cnone:");
  });
});
