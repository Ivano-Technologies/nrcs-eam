import { useAuth } from "@/_core/hooks/useAuth";
import { DashboardWidgetSettings } from "@/components/DashboardWidgetSettings";
import { OpenRegistrationSettings } from "@/components/OpenRegistrationSettings";

export default function DashboardSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Settings</h1>
        <p className="text-muted-foreground mt-2">
          Customize your dashboard experience
        </p>
      </div>

      {isAdmin && <OpenRegistrationSettings />}

      <DashboardWidgetSettings />
    </div>
  );
}
