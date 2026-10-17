import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

/** IVA-175: work_order_photos must have RLS on with only the service role policy (matches 0025). */
const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
afterAll(() => sql.end());

describe("work_order_photos RLS (IVA-175)", () => {
  it("has row level security enabled", async () => {
    const [row] = await sql`SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.work_order_photos')`;
    expect(row?.relrowsecurity).toBe(true);
  });

  it("only has the service_role_full_access policy for service_role", async () => {
    const rows = await sql`
      SELECT policyname, roles::text AS roles, cmd, qual, with_check
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'work_order_photos'`;
    expect(rows.map((r) => ({ ...r }))).toEqual([
      { policyname: "service_role_full_access", roles: "{service_role}", cmd: "ALL", qual: "true", with_check: "true" },
    ]);
  });
});
