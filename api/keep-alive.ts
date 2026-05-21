import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

export default async function handler(_req: unknown, res: { json: (body: unknown) => void }) {
  try {
    const db = await getDb();
    if (db) await db.execute(sql`SELECT 1`);
    res.json({ ok: true, ts: Date.now() });
  } catch {
    res.json({ ok: false, ts: Date.now() });
  }
}
