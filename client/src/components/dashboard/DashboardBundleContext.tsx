import type { AppRouter } from "../../../../server/routers";
import type { inferRouterOutputs } from "@trpc/server";
import { createContext, useContext, type ReactNode } from "react";

export type DashboardBundle = inferRouterOutputs<AppRouter>["dashboard"]["all"];

/** Progressive tier loads may populate sections incrementally. */
export type DashboardBundlePartial = Partial<DashboardBundle>;

export type DashboardSectionName =
  | "metrics"
  | "totalAssetValue"
  | "stockMovement"
  | "facilityStatus"
  | "recentActivity"
  | "pendingRequisitions"
  | "attentionItems"
  | "branchPerformance";

export type DashboardSectionLoadState = "ok" | "failed" | "timeout";

const DashboardBundleContext = createContext<DashboardBundlePartial | undefined>(undefined);
const DashboardRetryContext = createContext<() => void>(() => undefined);

export function DashboardBundleProvider({
  value,
  onRetry,
  children,
}: {
  value: DashboardBundlePartial | undefined;
  onRetry?: () => void;
  children: ReactNode;
}) {
  return (
    <DashboardRetryContext.Provider value={onRetry ?? (() => undefined)}>
      <DashboardBundleContext.Provider value={value}>{children}</DashboardBundleContext.Provider>
    </DashboardRetryContext.Provider>
  );
}

export function useDashboardBundle(): DashboardBundlePartial | undefined {
  return useContext(DashboardBundleContext);
}

export function useDashboardRetry(): () => void {
  return useContext(DashboardRetryContext);
}

export function dashboardSectionState(
  bundle: DashboardBundlePartial | undefined,
  section: DashboardSectionName
): DashboardSectionLoadState {
  if (bundle?.timedOutSections?.includes(section)) return "timeout";
  if (bundle?.failedSections?.includes(section)) return "failed";
  return "ok";
}
