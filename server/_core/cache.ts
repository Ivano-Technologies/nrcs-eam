/**
 * Optional shared cache (Upstash Redis REST). Falls back to in-process Map when unset
 * or when the remote cache throws / times out. Cache errors must never fail a request.
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

const CACHE_REMOTE_BUDGET_MS = 400;

/** Resolve `null` if `promise` has not settled. Does not cancel the underlying work. */
async function settleOrNull<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  const started = Date.now();
  try {
    const res = await settleOrNull(
      upstashFetch(`/get/${encodeURIComponent(key)}`),
      CACHE_REMOTE_BUDGET_MS
    );
    if (res?.ok) {
      const body = (await res.json()) as { result?: string | null };
      if (body.result != null) {
        void recordCacheHit(key, Date.now() - started);
        return body.result;
      }
    }
  } catch {
    // Remote cache is optional — fall through to in-process memory.
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
  try {
    const res = await settleOrNull(
      upstashFetch("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(["SET", key, value, "EX", ttlSeconds]),
      }),
      CACHE_REMOTE_BUDGET_MS
    );
    if (res?.ok) return;
  } catch {
    // Fall through to memory.
  }
  memorySet(key, value, ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await upstashFetch(`/del/${encodeURIComponent(key)}`, { method: "POST" });
  } catch {
    // Still drop the in-process entry.
  }
  memory.delete(key);
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await cacheGet(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await cacheSet(key, JSON.stringify(value), ttlSeconds);
  } catch {
    // Writes are best-effort.
  }
}

export async function withDashboardCache<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<T> {
  try {
    const cached = await cacheGetJson<T>(key);
    if (cached != null) return cached;
  } catch {
    // Compute fresh if the read fails.
  }
  const result = await compute();
  try {
    await cacheSetJson(key, result, ttlSeconds);
  } catch {
    // A failed write must not discard the computed result.
  }
  return result;
}

/** Test helper — clears the in-process fallback map. */
export function resetCacheMemoryForTests(): void {
  memory.clear();
}
