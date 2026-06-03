import { authorizeCronRequest, logCronRun } from "../../server/_core/cronAuth";
import { processPendingAsyncJobs } from "../../server/_core/asyncJobs";
import { captureServerEvent } from "../../server/_core/serverAnalytics";

export default async function handler(req: any, res: any) {
  const startedAt = Date.now();
  const auth = authorizeCronRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json(auth.body);
    return;
  }
  try {
    const result = await processPendingAsyncJobs(20);
    logCronRun("process-jobs", startedAt, result);
    captureServerEvent("cron", "cron_process_jobs_complete", result);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    logCronRun("process-jobs", startedAt, null, error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed" });
  }
}
