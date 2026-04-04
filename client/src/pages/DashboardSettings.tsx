import { DashboardWidgetSettings } from "@/components/DashboardWidgetSettings";

export default function DashboardSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Settings</h1>
        <p className="text-muted-foreground mt-2">
          Customize your dashboard experience
        </p>
      </div>
      
      <DashboardWidgetSettings />
    </div>
  );
}
