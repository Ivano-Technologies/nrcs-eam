export type DashboardPeriod = "Today" | "Week" | "Month" | "Quarter" | "Year";

const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  Today: 1,
  Week: 7,
  Month: 30,
  Quarter: 90,
  Year: 365,
};

function isoDateUTC(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function getPeriodWindow(period: DashboardPeriod, now = new Date()) {
  const days = PERIOD_DAYS[period];
  const currentEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const currentStart = new Date(currentEnd);
  currentStart.setUTCDate(currentStart.getUTCDate() - (days - 1));

  const previousEnd = new Date(currentStart);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - (days - 1));

  return {
    currentStartIso: isoDateUTC(currentStart),
    currentEndIso: isoDateUTC(currentEnd),
    previousStartIso: isoDateUTC(previousStart),
    previousEndIso: isoDateUTC(previousEnd),
  };
}

export function stockReadinessTone(adequate: number, total: number): "green" | "amber" | "red" {
  if (total <= 0) return "red";
  const ratio = adequate / total;
  if (ratio >= 0.8) return "green";
  if (ratio >= 0.5) return "amber";
  return "red";
}

export function directionFromDelta(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

export function percentDelta(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export function buildStockReadiness(params: { adequate: number; total: number; previousAdequate: number }) {
  const delta = params.adequate - params.previousAdequate;
  return {
    adequate: params.adequate,
    total: params.total,
    delta,
    direction: directionFromDelta(delta),
    tone: stockReadinessTone(params.adequate, params.total),
    goodWhen: "up" as const,
  };
}

export function buildDistributionVelocity(params: { current: number; previous: number; historicalTotal: number }) {
  return {
    value: params.current,
    deltaPercent: percentDelta(params.current, params.previous),
    direction: directionFromDelta(params.current - params.previous),
    hasData: !(params.current === 0 && params.historicalTotal === 0),
    goodWhen: "up" as const,
  };
}

