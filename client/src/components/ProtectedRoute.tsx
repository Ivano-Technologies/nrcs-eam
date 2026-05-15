import { useAuth } from "@/_core/hooks/useAuth";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { appPath } from "@/lib/routes";
import { Redirect, useLocation } from "wouter";

const CHANGE_PASSWORD_SETTINGS = `${appPath("/dashboard-settings")}?changePassword=required`;

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.mustChangePasswordOnLogin && location !== CHANGE_PASSWORD_SETTINGS) {
    return <Redirect to={CHANGE_PASSWORD_SETTINGS} />;
  }

  return <>{children}</>;
}
