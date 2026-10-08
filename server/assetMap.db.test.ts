/**
 * Asset Map SQL against the test database (CI Postgres), plus the role rule end to end.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { assetCategories, assets, inventoryItems, sites } from "../drizzle/schema";
import { getMapFacilityDetailRaw, queryMapFacilitiesRaw } from "./assetMap";
import { cacheDel } from "./_core/cache";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const stamp = Date.now().toString(36).toUpperCase().slice(-6);
let parentId = 0;
let childId = 0;
let categoryId = 0;
let createdCategory = false;

function ctxFor(role: AuthenticatedUser["role"], siteId: number | null): TrpcContext {
  return {
    user: {
      id: 1,
      openId: `map-${role}`,
      authUserId: null,
      email: `${role}@example.invalid`,
      name: role,
      loginMethod: "supabase",
      role,
      siteId,
      hasCompletedOnboarding: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as AuthenticatedUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("Test database unavailable");
  const [existingCategory] = await db.select({ id: assetCategories.id }).from(assetCategories).limit(1);
  if (existingCategory) {
    categoryId = existingCategory.id;
  } else {
    const [c] = await db
      .insert(assetCategories)
      .values({ name: `Map test ${stamp}` })
      .returning({ id: assetCategories.id });
    categoryId = c.id;
    createdCategory = true;
  }
  const [parent] = await db
    .insert(sites)
    .values({
      name: `Map Parent ${stamp}`,
      code: `MP${stamp}`,
      facilityType: "national_headquarters",
      latitude: "9.05800000",
      longitude: "7.49500000",
    })
    .returning({ id: sites.id });
  parentId = parent.id;
  const [child] = await db
    .insert(sites)
    .values({
      name: `Map Child ${stamp}`,
      code: `MC${stamp}`,
      facilityType: "branch",
      parentFacilityId: parentId,
      contactPerson: "Aminu Bello",
      contactPhone: "0803 555 0142",
    })
    .returning({ id: sites.id });
  childId = child.id;

  const statuses = ["operational", "operational", "maintenance", "repair", "retired", "disposed"] as const;
  await db.insert(assets).values(
    statuses.map((status, i) => ({
      assetTag: `MAPT-${stamp}-${i}`,
      name: `Map asset ${i}`,
      categoryId,
      siteId: childId,
      status,
      acquisitionCost: "1000.00",
      itemCategoryCode: "OE",
      itemType: "Asset",
    }))
  );
  await db.insert(inventoryItems).values({ itemCode: `MAPI-${stamp}`, name: "Map item", siteId: childId });
  await cacheDel("sites:mapNetworkData:v2");
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  await db.delete(assets).where(eq(assets.siteId, childId));
  await db.delete(inventoryItems).where(eq(inventoryItems.siteId, childId));
  await db.delete(sites).where(inArray(sites.id, [childId, parentId]));
  if (createdCategory) await db.delete(assetCategories).where(eq(assetCategories.id, categoryId));
  await cacheDel("sites:mapNetworkData:v2");
});

describe("Asset Map queries", () => {
  it("returns parent, numeric coordinates and status counts (disposed excluded)", async () => {
    const rows = await queryMapFacilitiesRaw();
    const parent = rows.find((r) => r.id === parentId)!;
    const child = rows.find((r) => r.id === childId)!;
    expect(parent.lat).toBeCloseTo(9.058);
    expect(parent.lng).toBeCloseTo(7.495);
    expect(child.lat).toBeNull();
    expect(child.parentFacilityId).toBe(parentId);
    expect(child.assetsByStatus).toEqual({ inUse: 2, maintenance: 2, retired: 1 });
    expect(child.assetCount).toBe(5);
    expect(child.inventoryCount).toBe(1);
  });

  it("loads drawer details with parent and operational book value", async () => {
    const detail = await getMapFacilityDetailRaw(childId);
    expect(detail).toMatchObject({
      id: childId,
      contactPerson: "Aminu Bello",
      parentFacility: { id: parentId, code: `MP${stamp}` },
      bookValue: 2000,
      openWorkOrders: 0,
      overdueWorkOrders: 0,
    });
    expect(await getMapFacilityDetailRaw(-1)).toBeNull();
  });

  it("field user on another facility gets no counts; admin gets them", async () => {
    const field = await appRouter.createCaller(ctxFor("field", parentId)).sites.mapFacilities();
    expect(field.facilities.find((f) => f.id === childId)).toMatchObject({
      statsVisible: false,
      assetCount: null,
    });
    const fieldDetail = await appRouter
      .createCaller(ctxFor("field", parentId))
      .sites.mapFacilityDetail({ id: childId });
    expect(fieldDetail.bookValue).toBeNull();

    const admin = await appRouter.createCaller(ctxFor("admin", null)).sites.mapFacilities();
    expect(admin.facilities.find((f) => f.id === childId)?.assetCount).toBe(5);
  });
});
