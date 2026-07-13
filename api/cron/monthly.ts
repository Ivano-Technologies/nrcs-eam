import { authorizeCronRequest, logCronRun } from "../../server/_core/cronAuth";
import { runMonthlyChecks } from "../../server/_core/inventoryAlerts";
import { writeBranchScorecardSnapshots } from "../../server/reports/branchScorecards";
import { captureServerEvent } from "../../server/_core/serverAnalytics";

export default async function handler(req: any, res: any) {
  const startedAt = Date.now();
  const auth = authorizeCronRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json(auth.body);
    return;
  }
  try {
    const monthly = await runMonthlyChecks();
    const snapshots = await writeBranchScorecardSnapshots();
    const result = { ...monthly, branchScorecardSnapshots: snapshots.written };
    logCronRun("monthly", startedAt, result);
    captureServerEvent("cron", "cron_monthly_complete", result);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    logCronRun("monthly", startedAt, null, error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed" });
  }
}
