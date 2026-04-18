import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Role-based UI flags. Server-side `requireRole` / procedures enforce access; this hides actions in the client.
 */
export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role ?? "";

  return {
    canEditAssets: ["manager", "admin"].includes(role),
    canEditSites: ["manager", "admin"].includes(role),
    canAddInventory: ["staff", "manager", "admin"].includes(role),
    canDeleteInventory: ["manager", "admin"].includes(role),
    canManageUsers: role === "admin",
    isAdmin: role === "admin",
    isManagerOrAdmin: ["manager", "admin"].includes(role),
    isStaffOrAbove: ["staff", "manager", "admin"].includes(role),
  };
}
