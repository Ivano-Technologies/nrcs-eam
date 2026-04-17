import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

export default async function handler(_req: any, res: any) {
  try {
    const db = await getDb();
    if (!db) {
      res.status(500).json({ ok: false, error: "Database pool not initialized" });
      return;
    }
    const result = await db.execute(sql`
      SELECT
        current_database() as db,
        current_schema() as schema,
        to_regclass('public.users') as users_table_exists,
        COUNT(*) as user_count
      FROM users
    `);
    res.status(200).json({ ok: true, result });
  } catch (e: any) {
    res.status(200).json({ ok: false, error: e?.message, code: e?.code });
  }
}
