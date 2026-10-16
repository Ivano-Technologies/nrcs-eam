import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * IVA-158: nrcs_generate_asset_code numbers assets with max(asset_num)+1 per branch + category.
 * Fire many concurrent inserts into one fresh branch, each in its own transaction that stays open a
 * little after the insert, which reliably collided on assets_assetTag_unique before the advisory lock.
 */
const url = process.env.DATABASE_URL ?? "";
const BRANCH = `RC${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
const N = 12;
const sql = postgres(url, { max: N, onnotice: () => {} });
let siteId = 0;
let categoryId = 0;

beforeAll(async () => {
  const [site] = await sql`
    INSERT INTO sites (code, name, "facilityType", "parentFacilityId")
    SELECT ${BRANCH}, ${"Asset code race " + BRANCH}, 'branch', id
    FROM sites WHERE "facilityType" = 'national_headquarters' ORDER BY id LIMIT 1
    RETURNING id`;
  if (!site) throw new Error("Seed data missing national headquarters");
  siteId = site.id;
  const [cat] = await sql`SELECT id FROM "assetCategories" ORDER BY id LIMIT 1`;
  if (!cat) throw new Error("Seed data missing asset categories");
  categoryId = cat.id;
});

afterAll(async () => {
  await sql`DELETE FROM assets WHERE branch_code = ${BRANCH}`;
  await sql`DELETE FROM sites WHERE code = ${BRANCH}`;
  await sql.end();
});

describe("asset code generation under concurrency (IVA-158)", () => {
  it("gives concurrent inserts for one branch + category distinct, gapless numbers", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: N }, (_, i) =>
        sql.begin(async (tx) => {
          const [row] = await tx`
            INSERT INTO assets ("assetTag", name, "categoryId", "siteId", "itemType", item_type, branch_code, item_category, item_category_code)
            VALUES (${`RACE-${BRANCH}-${i}`}, ${"Race asset " + i}, ${categoryId}, ${siteId}, 'Asset', 'Asset', ${BRANCH}, 'Office Equipment', 'OE')
            RETURNING asset_num, "assetTag"`;
          await tx`SELECT pg_sleep(0.05)`;
          return row;
        })
      )
    );
    const failures = results.filter((r) => r.status === "rejected");
    expect(failures.map((f) => String((f as PromiseRejectedResult).reason))).toEqual([]);
    const nums = results.map((r) => (r as PromiseFulfilledResult<{ asset_num: number }>).value.asset_num).sort((a, b) => a - b);
    expect(nums).toEqual(Array.from({ length: N }, (_, i) => i + 1));
    const tags = await sql`SELECT "assetTag" FROM assets WHERE branch_code = ${BRANCH} ORDER BY asset_num`;
    expect(tags.map((t) => t.assetTag)).toEqual(nums.map((n) => `NRCS_${BRANCH}OE${String(n).padStart(4, "0")}`));
  });
});
