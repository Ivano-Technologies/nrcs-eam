import { sql } from "drizzle-orm";
import type { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

let cachedMvAvailable: boolean | null = null;

/** Whether migration 0050 materialized view exists (cached for process lifetime). */
export async function isStockCardBalancesMvAvailable(database: Db): Promise<boolean> {
  if (cachedMvAvailable !== null) return cachedMvAvailable;
  try {
    const rows = await database.execute(sql`
      SELECT 1 AS ok
      FROM pg_matviews
      WHERE schemaname = 'public' AND matviewname = 'stock_card_balances'
      LIMIT 1
    `);
    const list = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows;
    cachedMvAvailable = Array.isArray(list) && list.length > 0;
  } catch {
    cachedMvAvailable = false;
  }
  return cachedMvAvailable;
}

/** Reset cache (tests or post-migration hooks). */
export function resetStockCardBalancesMvCache(): void {
  cachedMvAvailable = null;
}
