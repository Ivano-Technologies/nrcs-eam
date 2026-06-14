import type { AppRouter } from "../../../../server/routers";
import type { inferRouterOutputs } from "@trpc/server";
import { createContext, useContext, type ReactNode } from "react";

export type DashboardBundle = inferRouterOutputs<AppRouter>["dashboard"]["all"];

/** Progressive tier loads may populate sections incrementally. */
export type DashboardBundlePartial = Partial<DashboardBundle>;

const DashboardBundleContext = createContext<DashboardBundlePartial | undefined>(undefined);

export function DashboardBundleProvider({
  value,
  children,
}: {
  value: DashboardBundlePartial | undefined;
  children: ReactNode;
}) {
  return <DashboardBundleContext.Provider value={value}>{children}</DashboardBundleContext.Provider>;
}

export function useDashboardBundle(): DashboardBundlePartial | undefined {
  return useContext(DashboardBundleContext);
}
