/**
 * Optional shared cache (Upstash Redis REST). Falls back to in-process Map when unset.
 */

type CacheEntry = { value: string; expiresAt: number };

const memory = new Map<string, CacheEntry>();

function memoryGet(key: string): string | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds: number): void {
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function upstashFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return fetch(`${url}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
}

export async function cacheGet(key: string): Promise<string | null> {
  const res = await upstashFetch(`/get/${encodeURIComponent(key)}`);
  if (res?.ok) {
    const body = (await res.json()) as { result?: string | null };
    if (body.result != null) return body.result;
  }
  return memoryGet(key);
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const res = await upstashFetch(`/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${ttlSeconds}`, {
    method: "POST",
  });
  if (!res?.ok) memorySet(key, value, ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await upstashFetch(`/del/${encodeURIComponent(key)}`, { method: "POST" });
  memory.delete(key);
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const raw = await cacheGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await cacheSet(key, JSON.stringify(value), ttlSeconds);
}
