/**
 * IVA-177 / IVA-179: the trigger and helper functions run with a fixed search_path (Supabase advisor
 * "function_search_path_mutable"). Checks the migrated test database (CI Postgres).
 */
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

describe("function search_path (IVA-177, IVA-179)", () => {
  it.each(["nrcs_generate_asset_code()", "nrcs_item_category_code(text)", "enforce_facility_hierarchy()"])(
    "public.%s has search_path=public",
    async (signature) => {
      const db = await getDb();
      if (!db) throw new Error("Test database unavailable");
      const rows = (await db.execute(
        sql`SELECT proconfig FROM pg_proc WHERE oid = ${`public.${signature}`}::regprocedure`
      )) as unknown as Array<{ proconfig: string[] | null }>;
      expect(rows[0]?.proconfig ?? []).toContain("search_path=public");
    }
  );
});
