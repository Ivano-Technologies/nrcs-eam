import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

/** IVA-177: nrcs_generate_asset_code has a fixed search_path (migration 0060). */
const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
afterAll(() => sql.end());

describe("nrcs_generate_asset_code search_path (IVA-177)", () => {
  it("is pinned to public", async () => {
    const [row] = await sql`SELECT proconfig FROM pg_proc WHERE oid = 'public.nrcs_generate_asset_code()'::regprocedure`;
    expect(row?.proconfig).toEqual(["search_path=public"]);
  });
});
