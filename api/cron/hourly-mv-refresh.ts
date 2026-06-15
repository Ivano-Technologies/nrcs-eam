import { authorizeCronRequest, logCronRun } from "../../server/_core/cronAuth";
import { refreshDashboardMaterializedViews } from "../../server/_core/distributionVelocityMv";
import { captureServerEvent } from "../../server/_core/serverAnalytics";
import { getDb } from "../../server/db";

export default async function handler(req: any, res: any) {
  const startedAt = Date.now();
  const auth = authorizeCronRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json(auth.body);
    return;
  }
  try {
    const database = await getDb();
    if (!database) {
      res.status(503).json({ ok: false, error: "Database unavailable" });
      return;
    }
    const result = await refreshDashboardMaterializedViews(database);
    logCronRun("hourly-mv-refresh", startedAt, result);
    captureServerEvent("cron", "cron_hourly_mv_refresh_complete", result);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    logCronRun("hourly-mv-refresh", startedAt, null, error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed" });
  }
}
