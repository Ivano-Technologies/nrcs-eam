import { sql } from "drizzle-orm";
import { cache } from "../server/_core/cache";
import { getDb } from "../server/db";

export default async function handler(req: any, res: any) {
  if (req.query?.deep === "1") {
    try {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not initialized");
      }
      await db.execute(sql`SELECT 1`);
      return res.status(200).json({ ok: true, db: true, cacheEntries: cache.size() });
    } catch (err) {
      console.error("[health] DB check failed:", err);
      return res.status(503).json({ ok: false, db: false });
    }
  }
  return res.status(200).json({ ok: true });
}
