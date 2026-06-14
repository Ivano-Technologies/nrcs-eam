/**
 * Dashboard query priority tiers for progressive delivery.
 *
 * Lower tier number = higher priority (runs first through DashboardQueryQueue).
 * Tier 1 target: critical KPIs visible in <2s (metrics + totalAssetValue).
 */

export const DASHBOARD_QUERY_TIERS = {
  /** Critical KPIs — metrics subset + total asset value */
  TIER_1: 1,
  /** Secondary panels — facility status, requisitions, activity */
  TIER_2: 2,
  /** Heavy / chart data — stock movement, attention items, branch performance */
  TIER_3: 3,
} as const;

export type DashboardQueryTier = (typeof DASHBOARD_QUERY_TIERS)[keyof typeof DASHBOARD_QUERY_TIERS];

/** Dashboard bundle sections loaded by `dashboard.all` / `dashboard.byTier`. */
export type DashboardSection =
  | "metrics"
  | "totalAssetValue"
  | "facilityStatus"
  | "pendingRequisitions"
  | "recentActivity"
  | "stockMovement"
  | "attentionItems"
  | "branchPerformance";

/**
 * Section → tier mapping.
 *
 * Tier 1: metrics (lowStockItems, activeFacilities, stockReadiness, distributionVelocity), totalAssetValue
 * Tier 2: facilityStatus, pendingRequisitions, recentActivity
 * Tier 3: stockMovement, attentionItems, branchPerformance
 */
export const DASHBOARD_SECTION_TIER: Record<DashboardSection, DashboardQueryTier> = {
  metrics: DASHBOARD_QUERY_TIERS.TIER_1,
  totalAssetValue: DASHBOARD_QUERY_TIERS.TIER_1,
  facilityStatus: DASHBOARD_QUERY_TIERS.TIER_2,
  pendingRequisitions: DASHBOARD_QUERY_TIERS.TIER_2,
  recentActivity: DASHBOARD_QUERY_TIERS.TIER_2,
  stockMovement: DASHBOARD_QUERY_TIERS.TIER_3,
  attentionItems: DASHBOARD_QUERY_TIERS.TIER_3,
  branchPerformance: DASHBOARD_QUERY_TIERS.TIER_3,
};

/** Ordered tier list for sequential tier execution. */
export const DASHBOARD_TIER_ORDER: DashboardQueryTier[] = [
  DASHBOARD_QUERY_TIERS.TIER_1,
  DASHBOARD_QUERY_TIERS.TIER_2,
  DASHBOARD_QUERY_TIERS.TIER_3,
];

export function tierForSection(section: DashboardSection): DashboardQueryTier {
  return DASHBOARD_SECTION_TIER[section];
}

export function sectionsForTier(tier: DashboardQueryTier): DashboardSection[] {
  return (Object.entries(DASHBOARD_SECTION_TIER) as [DashboardSection, DashboardQueryTier][])
    .filter(([, t]) => t === tier)
    .map(([section]) => section);
}

/** Sub-queries inside `dashboard.metrics` — also capped by the shared queue. */
export const METRICS_SUBQUERY_PRIORITY = {
  activeFacilities: 1,
  totalFacilities: 1,
  inactiveFacilities: 1,
  adequateSites: 2,
  previousAdequateSites: 2,
  currentDistribution: 3,
  previousDistribution: 3,
  historicalDistribution: 3,
} as const;

export type MetricsSubqueryKey = keyof typeof METRICS_SUBQUERY_PRIORITY;

export function priorityForMetricsSubquery(key: MetricsSubqueryKey): number {
  return METRICS_SUBQUERY_PRIORITY[key];
}
