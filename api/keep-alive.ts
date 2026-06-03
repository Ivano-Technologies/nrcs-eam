import { sql } from "drizzle-orm";
import { authorizeCronRequest, logCronRun } from "../server/_core/cronAuth";
import { getDb } from "../server/db";

export default async function handler(
  req: { method?: string; headers?: { authorization?: string } },
  res: { status: (code: number) => { json: (body: unknown) => void }; json: (body: unknown) => void }
) {
  const startedAt = Date.now();
  const auth = authorizeCronRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json(auth.body);
    return;
  }
  try {
    const db = await getDb();
    if (db) await db.execute(sql`SELECT 1`);
    logCronRun("keep-alive", startedAt, { ok: true });
    res.status(200).json({ ok: true, ts: Date.now() });
  } catch (error) {
    logCronRun("keep-alive", startedAt, null, error);
    res.status(503).json({ ok: false, ts: Date.now() });
  }
}
