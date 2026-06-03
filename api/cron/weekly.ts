import { authorizeCronRequest, logCronRun } from "../../server/_core/cronAuth";
import { runWeeklyChecks } from "../../server/_core/inventoryAlerts";
import { captureServerEvent } from "../../server/_core/serverAnalytics";

export default async function handler(req: any, res: any) {
  const startedAt = Date.now();
  const auth = authorizeCronRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json(auth.body);
    return;
  }
  try {
    const result = await runWeeklyChecks();
    logCronRun("weekly", startedAt, result);
    captureServerEvent("cron", "cron_weekly_complete", result);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    logCronRun("weekly", startedAt, null, error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed" });
  }
}
