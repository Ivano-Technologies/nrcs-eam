/**
 * Optional shared cache (Upstash Redis REST). Falls back to in-process Map when unset.
 */

import { recordCacheHit, recordCacheMiss } from "./cacheMetrics";
import { upstashFetch } from "./upstashRedis";

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

export async function cacheGet(key: string): Promise<string | null> {
  const started = Date.now();
  const res = await upstashFetch(`/get/${encodeURIComponent(key)}`);
  if (res?.ok) {
    const body = (await res.json()) as { result?: string | null };
    if (body.result != null) {
      void recordCacheHit(key, Date.now() - started);
      return body.result;
    }
  }
  const mem = memoryGet(key);
  const durationMs = Date.now() - started;
  if (mem != null) {
    void recordCacheHit(key, durationMs);
    return mem;
  }
  void recordCacheMiss(key, durationMs);
  return null;
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const res = await upstashFetch("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(["SET", key, value, "EX", ttlSeconds]),
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

export async function withDashboardCache<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<T> {
  const cached = await cacheGetJson<T>(key);
  if (cached != null) return cached;
  const result = await compute();
  await cacheSetJson(key, result, ttlSeconds);
  return result;
}
