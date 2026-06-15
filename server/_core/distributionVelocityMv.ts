import { sql } from "drizzle-orm";
import type { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

let cachedMvAvailable: boolean | null = null;

/** Whether migration 0052 materialized view exists (cached for process lifetime). */
export async function isDistributionVelocityMvAvailable(database: Db): Promise<boolean> {
  if (cachedMvAvailable !== null) return cachedMvAvailable;
  try {
    const rows = await database.execute(sql`
      SELECT 1 AS ok
      FROM pg_matviews
      WHERE schemaname = 'public' AND matviewname = 'distribution_outbound_daily'
      LIMIT 1
    `);
    const list = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows;
    cachedMvAvailable = Array.isArray(list) && list.length > 0;
  } catch {
    cachedMvAvailable = false;
  }
  return cachedMvAvailable;
}

export function resetDistributionVelocityMvCache(): void {
  cachedMvAvailable = null;
}

export async function refreshDistributionOutboundDaily(
  database: Db,
  options: { concurrent?: boolean } = {}
): Promise<void> {
  const concurrent = options.concurrent ?? true;
  await database.execute(
    sql`SELECT refresh_distribution_outbound_daily(${concurrent})`
  );
}

export async function refreshStockCardBalancesMv(
  database: Db,
  options: { concurrent?: boolean } = {}
): Promise<void> {
  const concurrent = options.concurrent ?? true;
  await database.execute(sql`SELECT refresh_stock_card_balances(${concurrent})`);
}

/** Refresh dashboard materialized views (daily cron / manual). */
export async function refreshDashboardMaterializedViews(database: Db): Promise<{
  distributionOutbound: boolean;
  stockCardBalances: boolean;
}> {
  let distributionOutbound = false;
  let stockCardBalances = false;

  if (await isDistributionVelocityMvAvailable(database)) {
    await refreshDistributionOutboundDaily(database, { concurrent: true });
    distributionOutbound = true;
  }

  const { isStockCardBalancesMvAvailable } = await import("./stockCardBalancesMv");
  if (await isStockCardBalancesMvAvailable(database)) {
    await refreshStockCardBalancesMv(database, { concurrent: true });
    stockCardBalances = true;
  }

  return { distributionOutbound, stockCardBalances };
}
