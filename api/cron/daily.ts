import { authorizeCronRequest, logCronRun } from "../../server/_core/cronAuth";
import { refreshDashboardMaterializedViews } from "../../server/_core/distributionVelocityMv";
import { runDailyChecks } from "../../server/_core/inventoryAlerts";
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
    const dailyChecks = await runDailyChecks();
    const database = await getDb();
    const mvRefresh = database
      ? await refreshDashboardMaterializedViews(database)
      : { distributionOutbound: false, stockCardBalances: false };
    const result = { dailyChecks, mvRefresh };
    logCronRun("daily", startedAt, result);
    captureServerEvent("cron", "cron_daily_complete", result);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    logCronRun("daily", startedAt, null, error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed" });
  }
}
