import { upstashIncr, upstashLpush, upstashLrange, upstashLtrim } from "./upstashRedis";

const BUFFER_KEY = "dashboard:requests:buffer";
const MAX_BUFFER_SIZE = 50;
const TIER_TIMEOUT_KEY = "observability:tier_timeouts:24h";

export type TierLoadingState = "complete" | "failed" | "timeout";

export type DashboardRequestRecord = {
  source: "all" | "byTier";
  wallClockMs: number;
  tier1Ms: number | null;
  tier2Ms: number | null;
  tier3Ms: number | null;
  timedOutSections: string[];
  userId: string;
  timestamp: string;
  loadingState: {
    tier1: TierLoadingState;
    tier2: TierLoadingState;
    tier3: TierLoadingState;
  };
};

export type DashboardRequestStats = {
  avgWallClockMs: number;
  p95Ms: number;
  p99Ms: number;
  timeoutRatePct: number;
  failureRatePct: number;
  sampleSize: number;
};

const memoryBuffer: DashboardRequestRecord[] = [];
const memoryTierTimeouts: Record<string, number> = {
  tier1: 0,
  tier2: 0,
  tier3: 0,
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)] ?? 0;
}

function computeStats(records: DashboardRequestRecord[]): DashboardRequestStats {
  if (records.length === 0) {
    return {
      avgWallClockMs: 0,
      p95Ms: 0,
      p99Ms: 0,
      timeoutRatePct: 0,
      failureRatePct: 0,
      sampleSize: 0,
    };
  }
  const times = records.map((r) => r.wallClockMs).sort((a, b) => a - b);
  const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
  let timeoutCount = 0;
  let failureCount = 0;
  for (const r of records) {
    if (r.timedOutSections.length > 0) timeoutCount++;
    const states = Object.values(r.loadingState);
    if (states.some((s) => s === "failed")) failureCount++;
  }
  const n = records.length;
  return {
    avgWallClockMs: avg,
    p95Ms: percentile(times, 95),
    p99Ms: percentile(times, 99),
    timeoutRatePct: Math.round((timeoutCount / n) * 1000) / 10,
    failureRatePct: Math.round((failureCount / n) * 1000) / 10,
    sampleSize: n,
  };
}

export async function recordDashboardRequest(record: DashboardRequestRecord): Promise<void> {
  try {
    const payload = JSON.stringify(record);
    const pushed = await upstashLpush(BUFFER_KEY, payload);
    if (pushed) {
      await upstashLtrim(BUFFER_KEY, 0, MAX_BUFFER_SIZE - 1);
    } else {
      memoryBuffer.unshift(record);
      if (memoryBuffer.length > MAX_BUFFER_SIZE) memoryBuffer.length = MAX_BUFFER_SIZE;
    }

    for (const [tier, state] of Object.entries(record.loadingState) as [
      keyof DashboardRequestRecord["loadingState"],
      TierLoadingState,
    ][]) {
      if (state === "timeout") {
        const key = `${TIER_TIMEOUT_KEY}:${tier}`;
        const ok = await upstashIncr(key);
        if (!ok) memoryTierTimeouts[tier] = (memoryTierTimeouts[tier] ?? 0) + 1;
      }
    }
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: "dashboard_buffer_error",
        err: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

export async function getLastDashboardRequests(n = 10): Promise<DashboardRequestRecord[]> {
  try {
    const raw = await upstashLrange(BUFFER_KEY, 0, n - 1);
    if (raw.length > 0) {
      return raw
        .map((s) => {
          try {
            return JSON.parse(s) as DashboardRequestRecord;
          } catch {
            return null;
          }
        })
        .filter((r): r is DashboardRequestRecord => r != null);
    }
    return memoryBuffer.slice(0, n);
  } catch {
    return memoryBuffer.slice(0, n);
  }
}

export async function getDashboardRequestStats(): Promise<DashboardRequestStats> {
  const records = await getLastDashboardRequests(MAX_BUFFER_SIZE);
  return computeStats(records);
}

export async function getTierTimeoutCounts24h(): Promise<{ tier1: number; tier2: number; tier3: number }> {
  const read = async (tier: string): Promise<number> => {
    const { upstashGet } = await import("./upstashRedis");
    const raw = await upstashGet(`${TIER_TIMEOUT_KEY}:${tier}`);
    if (raw != null) {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    return memoryTierTimeouts[tier] ?? 0;
  };
  return {
    tier1: await read("tier1"),
    tier2: await read("tier2"),
    tier3: await read("tier3"),
  };
}

export function resetDashboardRequestBufferMemory(): void {
  memoryBuffer.length = 0;
  memoryTierTimeouts.tier1 = 0;
  memoryTierTimeouts.tier2 = 0;
  memoryTierTimeouts.tier3 = 0;
}
