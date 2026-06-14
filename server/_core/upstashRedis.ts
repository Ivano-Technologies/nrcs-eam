/**
 * Minimal Upstash Redis REST helpers (shared by cache + observability metrics).
 */

export async function upstashFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return fetch(`${url}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
}

export async function upstashIncr(key: string): Promise<boolean> {
  const res = await upstashFetch(`/incr/${encodeURIComponent(key)}`, { method: "POST" });
  if (!res?.ok) return false;
  await upstashFetch(`/expire/${encodeURIComponent(key)}/86400`, { method: "POST" });
  return true;
}

export async function upstashGet(key: string): Promise<string | null> {
  const res = await upstashFetch(`/get/${encodeURIComponent(key)}`);
  if (!res?.ok) return null;
  const body = (await res.json()) as { result?: string | null };
  return body.result ?? null;
}

export async function upstashSet(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const res = await upstashFetch(
    `/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${ttlSeconds}`,
    { method: "POST" }
  );
  return res?.ok ?? false;
}

export async function upstashLpush(key: string, value: string): Promise<boolean> {
  const res = await upstashFetch(`/lpush/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
  });
  if (!res?.ok) return false;
  await upstashFetch(`/expire/${encodeURIComponent(key)}/86400`, { method: "POST" });
  return true;
}

export async function upstashLtrim(key: string, start: number, stop: number): Promise<void> {
  await upstashFetch(`/ltrim/${encodeURIComponent(key)}/${start}/${stop}`, { method: "POST" });
}

export async function upstashLrange(key: string, start: number, stop: number): Promise<string[]> {
  const res = await upstashFetch(`/lrange/${encodeURIComponent(key)}/${start}/${stop}`);
  if (!res?.ok) return [];
  const body = (await res.json()) as { result?: string[] | null };
  return body.result ?? [];
}
