import { runMonthlyChecks } from "../../server/_core/inventoryAlerts";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  if (!process.env.CRON_SECRET) {
    console.error("[cron] CRON_SECRET is not set — rejecting request");
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }
  const authHeader = req.headers.authorization;
  if (authHeader !== "Bearer " + process.env.CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await runMonthlyChecks();
    res.status(200).json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed" });
  }
}
