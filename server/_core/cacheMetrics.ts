import { upstashGet, upstashIncr } from "./upstashRedis";

const METRICS_TTL_SECONDS = 86_400;
const KEY_HITS = "cache:metrics:hits";
const KEY_MISSES = "cache:metrics:misses";

export type CachePrefix =
  | "metrics"
  | "totalAssetValue"
  | "branchPerformance"
  | "mapNetworkData"
  | "other";

export type CachePrefixMetrics = {
  hits: number;
  misses: number;
  hitRatePct: number;
};

export type CacheMetricsSnapshot = {
  totalGets: number;
  hits: number;
  misses: number;
  hitRatePct: number;
  byPrefix: Record<CachePrefix, CachePrefixMetrics>;
};

const PREFIXES: CachePrefix[] = [
  "metrics",
  "totalAssetValue",
  "branchPerformance",
  "mapNetworkData",
  "other",
];

/** In-process fallback when Upstash is unset (local dev). */
const memoryCounters = new Map<string, number>();

export function cacheKeyToPrefix(key: string): CachePrefix {
  if (key.startsWith("dashboard:metrics")) return "metrics";
  if (key.startsWith("dashboard:totalAssetValue")) return "totalAssetValue";
  if (key.startsWith("dashboard:branchPerformance")) return "branchPerformance";
  if (key.startsWith("sites:mapNetworkData")) return "mapNetworkData";
  return "other";
}

function prefixHitsKey(prefix: CachePrefix): string {
  return `cache:metrics:prefix:${prefix}:hits`;
}

function prefixMissesKey(prefix: CachePrefix): string {
  return `cache:metrics:prefix:${prefix}:misses`;
}

function bumpMemory(key: string): void {
  memoryCounters.set(key, (memoryCounters.get(key) ?? 0) + 1);
}

async function incrCounter(globalKey: string, prefixKey: string): Promise<void> {
  const redisOk = (await upstashIncr(globalKey)) && (await upstashIncr(prefixKey));
  if (redisOk) return;
  bumpMemory(globalKey);
  bumpMemory(prefixKey);
}

async function incrMissCounter(globalKey: string, prefixKey: string): Promise<void> {
  const redisOk = (await upstashIncr(globalKey)) && (await upstashIncr(prefixKey));
  if (redisOk) return;
  bumpMemory(globalKey);
  bumpMemory(prefixKey);
}

async function readCounter(key: string): Promise<number> {
  const raw = await upstashGet(key);
  if (raw != null) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return memoryCounters.get(key) ?? 0;
}

export async function recordCacheHit(key: string, _durationMs?: number): Promise<void> {
  try {
    const prefix = cacheKeyToPrefix(key);
    await incrCounter(KEY_HITS, prefixHitsKey(prefix));
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: "cache_metrics_error",
        op: "hit",
        err: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

export async function recordCacheMiss(key: string, _durationMs?: number): Promise<void> {
  try {
    const prefix = cacheKeyToPrefix(key);
    await incrMissCounter(KEY_MISSES, prefixMissesKey(prefix));
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: "cache_metrics_error",
        op: "miss",
        err: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

function prefixMetrics(hits: number, misses: number): CachePrefixMetrics {
  const total = hits + misses;
  return {
    hits,
    misses,
    hitRatePct: total > 0 ? Math.round((hits / total) * 1000) / 10 : 0,
  };
}

export async function getCacheMetrics(): Promise<CacheMetricsSnapshot> {
  const hits = await readCounter(KEY_HITS);
  const misses = await readCounter(KEY_MISSES);
  const totalGets = hits + misses;

  const byPrefix = {} as Record<CachePrefix, CachePrefixMetrics>;
  for (const prefix of PREFIXES) {
    const pHits = await readCounter(prefixHitsKey(prefix));
    const pMisses = await readCounter(prefixMissesKey(prefix));
    byPrefix[prefix] = prefixMetrics(pHits, pMisses);
  }

  return {
    totalGets,
    hits,
    misses,
    hitRatePct: totalGets > 0 ? Math.round((hits / totalGets) * 1000) / 10 : 0,
    byPrefix,
  };
}

/** Test helper — clears in-memory counters only. */
export function resetCacheMetricsMemory(): void {
  memoryCounters.clear();
}

export { METRICS_TTL_SECONDS };
