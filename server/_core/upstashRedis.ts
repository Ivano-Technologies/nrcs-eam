/**
 * Minimal Upstash Redis REST helpers (shared by cache + observability metrics).
 * Never throws: a broken or missing cache must not take request handlers down.
 */

const UPSTASH_FETCH_TIMEOUT_MS = 1500;

let loggedUnconfigured = false;
let loggedFailure = false;

function warnOnceUnconfigured(reason: string): void {
  if (loggedUnconfigured) return;
  loggedUnconfigured = true;
  console.warn(JSON.stringify({ event: "upstash_cache_unconfigured", reason }));
}

function warnOnceFailure(err: unknown): void {
  if (loggedFailure) return;
  loggedFailure = true;
  console.warn(
    JSON.stringify({
      event: "upstash_cache_skipped",
      err: err instanceof Error ? err.message : String(err),
    })
  );
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function readUpstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!isHttpUrl(url)) {
    warnOnceUnconfigured("UPSTASH_REDIS_REST_URL must start with http:// or https://");
    return null;
  }
  return { url: url.replace(/\/$/, ""), token };
}

// Validate at module load (cold start) so a bad URL is logged once, not per call.
void readUpstashConfig();

export async function upstashFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const config = readUpstashConfig();
  if (!config) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTASH_FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${config.url}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${config.token}`, ...(init?.headers ?? {}) },
    });
  } catch (err) {
    warnOnceFailure(err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readUpstashResult<T>(res: Response | null): Promise<T | null> {
  if (!res?.ok) return null;
  try {
    const body = (await res.json()) as { result?: T | null };
    return body.result ?? null;
  } catch (err) {
    warnOnceFailure(err);
    return null;
  }
}

export async function upstashIncr(key: string): Promise<boolean> {
  try {
    const res = await upstashFetch(`/incr/${encodeURIComponent(key)}`, { method: "POST" });
    if (!res?.ok) return false;
    await upstashFetch(`/expire/${encodeURIComponent(key)}/86400`, { method: "POST" });
    return true;
  } catch (err) {
    warnOnceFailure(err);
    return false;
  }
}

export async function upstashGet(key: string): Promise<string | null> {
  try {
    const res = await upstashFetch(`/get/${encodeURIComponent(key)}`);
    return await readUpstashResult<string>(res);
  } catch (err) {
    warnOnceFailure(err);
    return null;
  }
}

export async function upstashSet(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  try {
    const res = await upstashFetch(
      `/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${ttlSeconds}`,
      { method: "POST" }
    );
    return res?.ok ?? false;
  } catch (err) {
    warnOnceFailure(err);
    return false;
  }
}

export async function upstashLpush(key: string, value: string): Promise<boolean> {
  try {
    const res = await upstashFetch(`/lpush/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
      method: "POST",
    });
    if (!res?.ok) return false;
    await upstashFetch(`/expire/${encodeURIComponent(key)}/86400`, { method: "POST" });
    return true;
  } catch (err) {
    warnOnceFailure(err);
    return false;
  }
}

export async function upstashLtrim(key: string, start: number, stop: number): Promise<void> {
  try {
    await upstashFetch(`/ltrim/${encodeURIComponent(key)}/${start}/${stop}`, { method: "POST" });
  } catch (err) {
    warnOnceFailure(err);
  }
}

export async function upstashLrange(key: string, start: number, stop: number): Promise<string[]> {
  try {
    const res = await upstashFetch(`/lrange/${encodeURIComponent(key)}/${start}/${stop}`);
    const result = await readUpstashResult<string[]>(res);
    return result ?? [];
  } catch (err) {
    warnOnceFailure(err);
    return [];
  }
}

/** Test helper — clears the once-per-cold-start log guards. */
export function resetUpstashWarnStateForTests(): void {
  loggedUnconfigured = false;
  loggedFailure = false;
}
