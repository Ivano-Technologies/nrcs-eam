import { authorizeCronRequest, logCronRun } from "../../server/_core/cronAuth";
import { runScheduledReports } from "../../server/_core/scheduledReportsCron";
import { captureServerEvent } from "../../server/_core/serverAnalytics";

export default async function handler(req: any, res: any) {
  const startedAt = Date.now();
  const auth = authorizeCronRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json(auth.body);
    return;
  }
  try {
    const result = await runScheduledReports();
    logCronRun("scheduled-reports", startedAt, result);
    captureServerEvent("cron", "cron_scheduled_reports_complete", result);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    logCronRun("scheduled-reports", startedAt, null, error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed" });
  }
}
