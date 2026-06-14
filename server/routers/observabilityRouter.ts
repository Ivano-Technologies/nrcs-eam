import { z } from "zod";
import { and, eq, gte, sql } from "drizzle-orm";
import { router } from "../_core/trpc";
import { adminProcedure } from "./roleProcedures";
import { getCacheMetrics } from "../_core/cacheMetrics";
import {
  getDashboardRequestStats,
  getLastDashboardRequests,
  getTierTimeoutCounts24h,
} from "../_core/dashboardRequestBuffer";
import { dashboardQueryQueue } from "../_core/dashboardQueryQueue";
import { cacheGetJson, cacheSetJson } from "../_core/cache";
import * as db from "../db";
import { auditLogs } from "../../drizzle/schema";

const DB_METRICS_CACHE_KEY = "observability:db:topTables";
const DB_METRICS_TTL = 3600;

export const observabilityRouter = router({
  poolStatus: adminProcedure.query(() => {
    const stats = dashboardQueryQueue.getStats();
    return {
      queueRunning: stats.running,
      queueQueued: stats.queued,
      maxConcurrent: stats.maxConcurrent,
      dbPoolMax: 3,
      poolDescription: "Supabase transaction pooler (postgres.js max: 3)",
    };
  }),

  cacheMetrics: adminProcedure.query(async () => getCacheMetrics()),

  dashboardRequests: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 10;
      const [last10, stats] = await Promise.all([
        getLastDashboardRequests(limit),
        getDashboardRequestStats(),
      ]);
      return { last10, ...stats };
    }),

  databaseMetrics: adminProcedure.query(async () => {
    const database = await db.getDb();
    if (!database) {
      return {
        topTables: [] as Array<{ name: string; rowCount: number; sizeMb: number }>,
        failedLogins24h: 0,
        tierTimeoutCounts24h: { tier1: 0, tier2: 0, tier3: 0 },
        queryLatencies: { p50: 0, p95: 0, p99: 0 },
      };
    }

    type TopTable = { name: string; rowCount: number; sizeMb: number };
    let topTables = await cacheGetJson<TopTable[]>(DB_METRICS_CACHE_KEY);
    if (!topTables) {
      const rows = await database.execute(sql`
        SELECT
          relname AS name,
          COALESCE(n_live_tup, 0)::bigint AS row_count,
          ROUND((pg_total_relation_size(c.oid) / 1024.0 / 1024.0)::numeric, 2)::float AS size_mb
        FROM pg_stat_user_tables s
        JOIN pg_class c ON c.relname = s.relname AND c.relkind = 'r'
        WHERE s.schemaname = 'public'
        ORDER BY pg_total_relation_size(c.oid) DESC
        LIMIT 5
      `);
      const list = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? [];
      topTables = (list as Array<{ name: string; row_count: number; size_mb: number }>).map((r) => ({
        name: String(r.name),
        rowCount: Number(r.row_count ?? 0),
        sizeMb: Number(r.size_mb ?? 0),
      }));
      await cacheSetJson(DB_METRICS_CACHE_KEY, topTables, DB_METRICS_TTL);
    }

    const since = new Date(Date.now() - 86_400_000);
    const [failedRow] = await database
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "auth.login_failure"), gte(auditLogs.timestamp, since)));

    const tierTimeoutCounts24h = await getTierTimeoutCounts24h();
    const dashStats = await getDashboardRequestStats();

    return {
      topTables,
      failedLogins24h: Number(failedRow?.total ?? 0),
      tierTimeoutCounts24h,
      queryLatencies: {
        p50: dashStats.avgWallClockMs,
        p95: dashStats.p95Ms,
        p99: dashStats.p99Ms,
      },
    };
  }),
});
