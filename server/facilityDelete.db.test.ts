/**
 * IVA-181: deleting a facility that assets still point at is blocked with a clear message (no raw database
 * error), and a facility with nothing linked still deletes. Runs against the test database (CI Postgres).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, or } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { assetCategories, assets, sites } from "../drizzle/schema";
import { FACILITY_HAS_ASSETS_MESSAGE, FACILITY_HAS_CHILDREN_MESSAGE, isAssetReferenceError } from "./facilityDelete";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase().slice(-8);
const siteIds: number[] = [];
const codes: string[] = [];
let nhqId = 0;
let categoryId = 0;

function ctx(role: AuthenticatedUser["role"] = "admin"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: `facility-delete-${role}`,
      authUserId: null,
      email: `${role}@example.invalid`,
      name: role,
      loginMethod: "supabase",
      role,
      siteId: null,
      hasCompletedOnboarding: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as AuthenticatedUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// Names start with "Zz" so other tests that pick the first facility by name never land on these.
async function makeBranch(suffix: string, parentFacilityId = nhqId) {
  const db = (await getDb())!;
  const code = `FD${suffix}${stamp}`;
  const [row] = await db
    .insert(sites)
    .values({ name: `Zz Facility delete ${suffix} ${stamp}`, code, facilityType: "branch", parentFacilityId })
    .returning({ id: sites.id });
  siteIds.push(row.id);
  codes.push(code);
  return { id: row.id, code };
}

async function makeAsset(siteId: number, branchCode: string, i: number) {
  const db = (await getDb())!;
  const [row] = await db
    .insert(assets)
    .values({
      assetTag: `FDT-${stamp}-${i}`,
      name: `Facility delete asset ${i}`,
      categoryId,
      siteId,
      branchCode,
      status: "operational",
      itemCategoryCode: "OE",
      itemType: "Asset",
    })
    .returning({ id: assets.id, assetCode: assets.assetCode });
  return row;
}

const siteExists = async (id: number) =>
  (await (await getDb())!.select({ id: sites.id }).from(sites).where(eq(sites.id, id))).length === 1;

beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("Test database unavailable");
  const [category] = await db.select({ id: assetCategories.id }).from(assetCategories).limit(1);
  if (!category) throw new Error("Seed data missing asset categories");
  categoryId = category.id;
  const [nhq] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.facilityType, "national_headquarters"))
    .limit(1);
  if (!nhq) throw new Error("Seed data missing national headquarters");
  nhqId = nhq.id;
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  if (siteIds.length) {
    await db.delete(assets).where(or(inArray(assets.siteId, siteIds), inArray(assets.branchCode, codes)));
    // Children before parents.
    await db.delete(sites).where(inArray(sites.parentFacilityId, siteIds));
    await db.delete(sites).where(inArray(sites.id, siteIds));
  }
});

describe("Facility delete guard (IVA-181)", () => {
  it("blocks a facility that still has assets, with the clear message, and keeps it", async () => {
    const site = await makeBranch("A");
    const asset = await makeAsset(site.id, site.code, 1);
    expect(asset.assetCode).toBeTruthy();

    const res = await appRouter.createCaller(ctx()).sites.bulkDelete({ ids: [site.id] });

    expect(res.deleted).toBe(0);
    expect(res.failedIds).toEqual([site.id]);
    expect(res.failures).toEqual([{ id: site.id, reason: "has_assets", message: FACILITY_HAS_ASSETS_MESSAGE }]);
    expect(FACILITY_HAS_ASSETS_MESSAGE).toBe("Move or retire this facility's assets first.");
    expect(JSON.stringify(res)).not.toMatch(/immutable|asset_code|Failed query/i);
    expect(await siteExists(site.id)).toBe(true);
  });

  it("blocks a facility whose code is still on an asset that now sits at another facility", async () => {
    // asset_code embeds the branch code, so moving an asset keeps branch_code; the FK still points here.
    const original = await makeBranch("B");
    const elsewhere = await makeBranch("C");
    const db = (await getDb())!;
    const asset = await makeAsset(original.id, original.code, 2);
    await db.update(assets).set({ siteId: elsewhere.id }).where(eq(assets.id, asset.id));

    const res = await appRouter.createCaller(ctx()).sites.bulkDelete({ ids: [original.id] });

    expect(res.deleted).toBe(0);
    expect(res.failures?.[0]).toMatchObject({ reason: "has_assets", message: FACILITY_HAS_ASSETS_MESSAGE });
    expect(await siteExists(original.id)).toBe(true);
  });

  it("blocks a facility with child facilities", async () => {
    const parent = await makeBranch("P");
    // A branch can't parent a branch, so the child is a clinic under it.
    const db = (await getDb())!;
    const [child] = await db
      .insert(sites)
      .values({ name: `Zz Facility delete child ${stamp}`, code: `FDK${stamp}`, facilityType: "clinic", parentFacilityId: parent.id })
      .returning({ id: sites.id });
    siteIds.push(child.id);
    codes.push(`FDK${stamp}`);

    const res = await appRouter.createCaller(ctx("manager")).sites.bulkDelete({ ids: [parent.id] });

    expect(res.deleted).toBe(0);
    expect(res.failures?.[0]).toMatchObject({ reason: "has_children", message: FACILITY_HAS_CHILDREN_MESSAGE });
  });

  it("deletes a facility with no assets or child facilities", async () => {
    const site = await makeBranch("D");
    const res = await appRouter.createCaller(ctx()).sites.bulkDelete({ ids: [site.id] });
    expect(res).toMatchObject({ deleted: 1, total: 1, failedIds: [], failures: [] });
    expect(await siteExists(site.id)).toBe(false);
  });

  it("deletes the free facilities in a mixed batch and reports the blocked one", async () => {
    const blocked = await makeBranch("E");
    await makeAsset(blocked.id, blocked.code, 3);
    const free = await makeBranch("F");

    const res = await appRouter.createCaller(ctx()).sites.bulkDelete({ ids: [blocked.id, free.id] });

    expect(res.deleted).toBe(1);
    expect(res.failures).toEqual([{ id: blocked.id, reason: "has_assets", message: FACILITY_HAS_ASSETS_MESSAGE }]);
    expect(await siteExists(free.id)).toBe(false);
    expect(await siteExists(blocked.id)).toBe(true);
  });
});

describe("isAssetReferenceError", () => {
  it("recognises the trigger and foreign key refusals, including when wrapped", () => {
    expect(isAssetReferenceError(new Error("asset_code is immutable once generated"))).toBe(true);
    const wrapped = new Error("Failed query: delete from \"sites\"", {
      cause: new Error("asset_code is immutable once generated"),
    });
    expect(isAssetReferenceError(wrapped)).toBe(true);
    expect(isAssetReferenceError(new Error('violates foreign key constraint "assets_branch_code_sites_code_fk"'))).toBe(true);
    expect(isAssetReferenceError(new Error("connection reset"))).toBe(false);
    expect(isAssetReferenceError(null)).toBe(false);
  });
});
