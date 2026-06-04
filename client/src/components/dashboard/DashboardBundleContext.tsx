import type { AppRouter } from "../../../../server/routers";
import type { inferRouterOutputs } from "@trpc/server";
import { createContext, useContext, type ReactNode } from "react";

export type DashboardBundle = inferRouterOutputs<AppRouter>["dashboard"]["all"];

const DashboardBundleContext = createContext<DashboardBundle | undefined>(undefined);

export function DashboardBundleProvider({
  value,
  children,
}: {
  value: DashboardBundle | undefined;
  children: ReactNode;
}) {
  return <DashboardBundleContext.Provider value={value}>{children}</DashboardBundleContext.Provider>;
}

export function useDashboardBundle(): DashboardBundle | undefined {
  return useContext(DashboardBundleContext);
}
