/**
 * Asset Map role scoping (Kezie decision, 8 Oct 2026):
 * field staff see asset counts and book value only for their own facility;
 * managers and admins see every facility. Enforced in the tRPC procedures.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import type { MapFacilityDetailRaw, MapFacilityRaw } from "../assetMap";

const OWN_SITE = 11;
const OTHER_SITE = 22;

function rawFacility(id: number, overrides: Partial<MapFacilityRaw> = {}): MapFacilityRaw {
  return {
    id,
    code: `FAC-${id}`,
    name: `Facility ${id}`,
    facilityType: "branch",
    lat: 9 + id / 100,
    lng: 7 + id / 100,
    parentFacilityId: null,
    city: "Abuja",
    state: "FCT",
    isActive: true,
    stockScorePercent: 80,
    adequateCards: 8,
    totalCards: 10,
    lastMovementDate: "2026-10-06",
    assetCount: 64,
    assetsByStatus: { inUse: 56, maintenance: 5, retired: 3 },
    inventoryCount: 212,
    ...overrides,
  };
}

function rawDetail(id: number): MapFacilityDetailRaw {
  return {
    id,
    address: "Plot 1",
    contactPerson: "Aminu Bello",
    contactPhone: "0803 555 0142",
    parentFacility: { id: 1, name: "National Headquarters", code: "NHQ-001" },
    bookValue: 184_600_000,
    openWorkOrders: 3,
    overdueWorkOrders: 1,
  };
}

const getMapFacilitiesCached = vi.fn();
const getMapFacilityDetailRaw = vi.fn();

vi.mock("../assetMap", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../assetMap")>();
  return {
    ...actual,
    getMapFacilitiesCached: (...args: unknown[]) => getMapFacilitiesCached(...args),
    getMapFacilityDetailRaw: (...args: unknown[]) => getMapFacilityDetailRaw(...args),
  };
});

const { appRouter } = await import("../routers");
const { canSeeFacilityStats, mapStatsScope } = await import("../assetMap");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function ctxFor(role: AuthenticatedUser["role"], siteId: number | null): TrpcContext {
  const user: AuthenticatedUser = {
    id: 7,
    openId: `test-${role}`,
    authUserId: null,
    email: `${role}@example.invalid`,
    name: `Test ${role}`,
    loginMethod: "supabase",
    role,
    siteId,
    hasCompletedOnboarding: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as AuthenticatedUser;
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  getMapFacilitiesCached.mockReset();
  getMapFacilityDetailRaw.mockReset();
  getMapFacilitiesCached.mockResolvedValue({
    generatedAt: "2026-10-08T09:12:00.000Z",
    rows: [rawFacility(OWN_SITE), rawFacility(OTHER_SITE)],
  });
  getMapFacilityDetailRaw.mockImplementation(async (id: number) => rawDetail(id));
});

describe("canSeeFacilityStats / mapStatsScope", () => {
  it("managers and admins see every facility", () => {
    expect(canSeeFacilityStats({ role: "manager", siteId: null }, OTHER_SITE)).toBe(true);
    expect(canSeeFacilityStats({ role: "admin", siteId: OWN_SITE }, OTHER_SITE)).toBe(true);
    expect(mapStatsScope({ role: "admin", siteId: null })).toBe("all");
  });

  it("field, staff and user roles see only their own facility", () => {
    for (const role of ["field", "staff", "user"]) {
      expect(canSeeFacilityStats({ role, siteId: OWN_SITE }, OWN_SITE)).toBe(true);
      expect(canSeeFacilityStats({ role, siteId: OWN_SITE }, OTHER_SITE)).toBe(false);
      expect(mapStatsScope({ role, siteId: OWN_SITE })).toBe("own");
    }
  });

  it("an unassigned field user sees no facility figures", () => {
    expect(canSeeFacilityStats({ role: "field", siteId: null }, OWN_SITE)).toBe(false);
    expect(mapStatsScope({ role: "field", siteId: null })).toBe("none");
  });
});

describe("sites.mapFacilities (asset layer data)", () => {
  it("field user: asset counts only for their own facility", async () => {
    const caller = appRouter.createCaller(ctxFor("field", OWN_SITE));
    const result = await caller.sites.mapFacilities();
    expect(result.statsScope).toBe("own");
    expect(result.ownFacilityId).toBe(OWN_SITE);

    const own = result.facilities.find((f) => f.id === OWN_SITE)!;
    const other = result.facilities.find((f) => f.id === OTHER_SITE)!;
    expect(own).toMatchObject({
      statsVisible: true,
      assetCount: 64,
      assetsByStatus: { inUse: 56, maintenance: 5, retired: 3 },
    });
    expect(other).toMatchObject({ statsVisible: false, assetCount: null, assetsByStatus: null });
    // The facility itself (location, readiness) stays visible to everyone.
    expect(other).toMatchObject({ name: "Facility 22", stockScorePercent: 80, lat: expect.any(Number) });
    // Nothing in the payload leaks the hidden count.
    expect(JSON.stringify(other)).not.toContain("64");
  });

  it("staff user follows the same rule as field", async () => {
    const caller = appRouter.createCaller(ctxFor("staff", OTHER_SITE));
    const result = await caller.sites.mapFacilities();
    expect(result.facilities.find((f) => f.id === OTHER_SITE)?.assetCount).toBe(64);
    expect(result.facilities.find((f) => f.id === OWN_SITE)?.assetCount).toBeNull();
  });

  it("manager sees asset counts for every facility", async () => {
    const caller = appRouter.createCaller(ctxFor("manager", OWN_SITE));
    const result = await caller.sites.mapFacilities();
    expect(result.statsScope).toBe("all");
    expect(result.facilities.every((f) => f.statsVisible && f.assetCount === 64)).toBe(true);
  });

  it("admin sees asset counts for every facility", async () => {
    const caller = appRouter.createCaller(ctxFor("admin", null));
    const result = await caller.sites.mapFacilities();
    expect(result.statsScope).toBe("all");
    expect(result.facilities.map((f) => f.assetCount)).toEqual([64, 64]);
  });

  it("does not mutate the cached rows between callers", async () => {
    const shared = { generatedAt: "x", rows: [rawFacility(OWN_SITE), rawFacility(OTHER_SITE)] };
    getMapFacilitiesCached.mockResolvedValue(shared);
    await appRouter.createCaller(ctxFor("field", OWN_SITE)).sites.mapFacilities();
    const admin = await appRouter.createCaller(ctxFor("admin", null)).sites.mapFacilities();
    expect(admin.facilities.map((f) => f.assetCount)).toEqual([64, 64]);
    expect(shared.rows[1].assetCount).toBe(64);
  });
});

describe("sites.mapFacilityDetail (drawer data)", () => {
  it("field user: book value and work orders for their own facility", async () => {
    const caller = appRouter.createCaller(ctxFor("field", OWN_SITE));
    const own = await caller.sites.mapFacilityDetail({ id: OWN_SITE });
    expect(own).toMatchObject({
      statsVisible: true,
      bookValue: 184_600_000,
      openWorkOrders: 3,
      overdueWorkOrders: 1,
    });
  });

  it("field user: no book value or work orders for another facility", async () => {
    const caller = appRouter.createCaller(ctxFor("field", OWN_SITE));
    const other = await caller.sites.mapFacilityDetail({ id: OTHER_SITE });
    expect(other).toMatchObject({
      statsVisible: false,
      bookValue: null,
      openWorkOrders: null,
      overdueWorkOrders: null,
    });
    // Contact details stay visible, as on the facility page.
    expect(other.contactPerson).toBe("Aminu Bello");
    expect(JSON.stringify(other)).not.toContain("184600000");
  });

  it("manager and admin see book value for any facility", async () => {
    for (const role of ["manager", "admin"] as const) {
      const caller = appRouter.createCaller(ctxFor(role, OWN_SITE));
      const other = await caller.sites.mapFacilityDetail({ id: OTHER_SITE });
      expect(other).toMatchObject({ statsVisible: true, bookValue: 184_600_000, openWorkOrders: 3 });
    }
  });

  it("returns NOT_FOUND for an unknown facility", async () => {
    getMapFacilityDetailRaw.mockResolvedValue(null);
    const caller = appRouter.createCaller(ctxFor("admin", null));
    await expect(caller.sites.mapFacilityDetail({ id: 999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("requires sign in", async () => {
    const caller = appRouter.createCaller({ ...ctxFor("admin", null), user: null });
    await expect(caller.sites.mapFacilities()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.sites.mapFacilityDetail({ id: OWN_SITE })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
