import { createContext, useContext, type PropsWithChildren } from "react";
import type { UserRole } from "./types";

type DashboardRolePreviewContextValue = {
  actualRole: UserRole;
  effectiveRole: UserRole;
  setEffectiveRole: (role: UserRole) => void;
};

const DashboardRolePreviewContext = createContext<DashboardRolePreviewContextValue | null>(null);

export function DashboardRolePreviewProvider(props: PropsWithChildren<DashboardRolePreviewContextValue>) {
  const { children, ...value } = props;
  return <DashboardRolePreviewContext.Provider value={value}>{children}</DashboardRolePreviewContext.Provider>;
}

export function useDashboardRolePreview() {
  return useContext(DashboardRolePreviewContext);
}
