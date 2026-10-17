/**
 * IVA-178: the insurance-expiring count follows the user's facility. A policy belongs to its own facility,
 * or to its asset's facility when it has none. Runs against the test database (CI Postgres).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { assetCategories, assets, insuranceRecords, sites } from "../drizzle/schema";
import { countInsuranceExpiringSoon, listInsuranceRecords, toIsoDate } from "./financeModulesDb";

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase().slice(-8);
const siteIds: number[] = [];
const policyIds: number[] = [];
let assetId = 0;
let siteA = 0;
let siteB = 0;

const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("Test database unavailable");
  const [nhq] = await db.select({ id: sites.id }).from(sites).where(eq(sites.facilityType, "national_headquarters")).limit(1);
  const [category] = await db.select({ id: assetCategories.id }).from(assetCategories).limit(1);
  if (!nhq || !category) throw new Error("Seed data missing");
  for (const s of ["A", "B"]) {
    const [row] = await db
      .insert(sites)
      .values({ name: `Zz Insurance scope ${s} ${stamp}`, code: `IS${s}${stamp}`, facilityType: "branch", parentFacilityId: nhq.id })
      .returning({ id: sites.id });
    siteIds.push(row.id);
  }
  [siteA, siteB] = siteIds;
  const [asset] = await db
    .insert(assets)
    .values({
      assetTag: `INS-${stamp}`,
      name: "Insured vehicle",
      categoryId: category.id,
      siteId: siteA,
      status: "operational",
      itemCategoryCode: "VE",
      itemType: "Asset",
    })
    .returning({ id: assets.id });
  assetId = asset.id;
  const base = { insuranceType: "Vehicle", insurer: "AXA Mansard", policyStart: inDays(-300) };
  const rows = await db
    .insert(insuranceRecords)
    .values([
      // Expiring at A by facility.
      { ...base, siteId: siteA, assetId: null, policyNumber: `${stamp}-1`, policyEnd: inDays(10) },
      // Expiring at A through the asset (no facility on the policy).
      { ...base, siteId: null, assetId, policyNumber: `${stamp}-2`, policyEnd: inDays(20) },
      // Expiring at B.
      { ...base, siteId: siteB, assetId: null, policyNumber: `${stamp}-3`, policyEnd: inDays(5) },
      // At A but not expiring soon.
      { ...base, siteId: siteA, assetId: null, policyNumber: `${stamp}-4`, policyEnd: inDays(200) },
    ])
    .returning({ id: insuranceRecords.id });
  policyIds.push(...rows.map((r) => r.id));
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  if (policyIds.length) await db.delete(insuranceRecords).where(inArray(insuranceRecords.id, policyIds));
  if (assetId) await db.delete(assets).where(eq(assets.id, assetId));
  for (const id of siteIds) await db.delete(sites).where(eq(sites.id, id));
});

describe("countInsuranceExpiringSoon scope (IVA-178)", () => {
  it("counts a facility's own policies and its assets' policies only", async () => {
    await expect(countInsuranceExpiringSoon({ siteId: siteA })).resolves.toBe(2);
    await expect(countInsuranceExpiringSoon({ siteId: siteB })).resolves.toBe(1);
  });

  it("counts zero without a facility", async () => {
    await expect(countInsuranceExpiringSoon({ siteId: null })).resolves.toBe(0);
  });

  it("counts the whole organisation for admins (no scope)", async () => {
    const all = await countInsuranceExpiringSoon();
    expect(all).toBeGreaterThanOrEqual(3);
  });
});

describe("insurance dates (IVA-178)", () => {
  it("lists real YYYY-MM-DD dates and the right status", async () => {
    const rows = (await listInsuranceRecords({ siteId: siteA })).filter((r) => r.policyNumber.startsWith(stamp));
    expect(rows.map((r) => r.status).sort()).toEqual(["active", "expiring"]);
    for (const r of rows) {
      expect(r.policyEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.policyStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("toIsoDate formats Dates, keeps date strings, and blanks empty or invalid values", () => {
    expect(toIsoDate(new Date(2026, 9, 27))).toBe("2026-10-27");
    expect(toIsoDate("2026-10-27")).toBe("2026-10-27");
    expect(toIsoDate(null)).toBe("");
    expect(toIsoDate(new Date("nope"))).toBe("");
  });
});
