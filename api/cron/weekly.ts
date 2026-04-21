import { runWeeklyChecks } from "../../server/_core/inventoryAlerts";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    const result = await runWeeklyChecks();
    res.status(200).json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed" });
  }
}
