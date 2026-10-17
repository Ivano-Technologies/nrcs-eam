/**
 * IVA-179 hardening (0062): fleet_drivers and user_positions are service-role only, so anon and
 * authenticated (PostgREST) hold no privileges on them. Checks the migrated test database (CI Postgres).
 */
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

describe("fleet table grants (IVA-179)", () => {
  it.each(["fleet_drivers", "user_positions"])("anon and authenticated hold no privileges on public.%s", async (table) => {
    const db = await getDb();
    if (!db) throw new Error("Test database unavailable");
    const rows = (await db.execute(sql`
      SELECT grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = ${table} AND grantee IN ('anon', 'authenticated')
    `)) as unknown as Array<{ grantee: string; privilege_type: string }>;
    expect(rows).toEqual([]);
  });
});
