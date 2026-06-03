/**
 * Shared auth + structured logging for Vercel cron handlers.
 */

export function authorizeCronRequest(req: {
  method?: string;
  headers?: { authorization?: string };
}): { ok: true } | { ok: false; status: number; body: Record<string, unknown> } {
  if (req.method && req.method !== "GET" && req.method !== "POST") {
    return { ok: false, status: 405, body: { ok: false, error: "Method not allowed" } };
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(JSON.stringify({ type: "cron_auth", ok: false, reason: "CRON_SECRET unset" }));
    return { ok: false, status: 500, body: { error: "Server misconfiguration" } };
  }
  const authHeader = req.headers?.authorization;
  if (authHeader !== `Bearer ${secret}`) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  return { ok: true };
}

export function logCronRun(job: string, startedAt: number, result: unknown, error?: unknown) {
  const payload = {
    type: "cron_run",
    job,
    durationMs: Date.now() - startedAt,
    ok: !error,
    result: error ? undefined : result,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
  };
  if (error) console.error(JSON.stringify(payload));
  else console.info(JSON.stringify(payload));
}
