type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidate(prefix: string): void {
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export const cache = new TTLCache();

export const TTL = {
  DASHBOARD: 60_000,
  FACILITY_STATUS: 120_000,
  SITES: 300_000,
  CATEGORIES: 600_000,
  RECENT_ACTIVITY: 30_000,
  ATTENTION: 60_000,
} as const;

export async function withCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) return cached;
  const fresh = await fn();
  cache.set(key, fresh, ttlMs);
  return fresh;
}
