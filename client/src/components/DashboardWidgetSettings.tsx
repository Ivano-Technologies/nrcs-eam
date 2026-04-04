import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

const DEFAULT_WIDGETS = {
  totalAssets: true,
  assetsInMaintenance: true,
  pendingWorkOrders: true,
  lowStockItems: true,
  upcomingMaintenance: true,
  lowStockAlerts: true,
};

export function DashboardWidgetSettings() {
  const { data: prefs } = trpc.userPreferences.get.useQuery();
  const updateWidgets = trpc.userPreferences.updateDashboardWidgets.useMutation();
  
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);

  useEffect(() => {
    if (prefs?.dashboardWidgets) {
      try {
        const parsed = JSON.parse(prefs.dashboardWidgets);
        setWidgets({ ...DEFAULT_WIDGETS, ...parsed });
      } catch {
        setWidgets(DEFAULT_WIDGETS);
      }
    }
  }, [prefs]);

  const handleToggle = async (key: string, value: boolean) => {
    const newWidgets = { ...widgets, [key]: value };
    setWidgets(newWidgets);
    await updateWidgets.mutateAsync({ widgets: newWidgets });
  };

  const widgetLabels: Record<string, { title: string; description: string }> = {
    totalAssets: { title: "Total Assets", description: "Show total asset count card" },
    assetsInMaintenance: { title: "Assets in Maintenance", description: "Show maintenance status card" },
    pendingWorkOrders: { title: "Pending Work Orders", description: "Show pending work orders card" },
    lowStockItems: { title: "Low Stock Items", description: "Show inventory alerts card" },
    upcomingMaintenance: { title: "Upcoming Maintenance", description: "Show scheduled maintenance card" },
    lowStockAlerts: { title: "Low Stock Alerts", description: "Show stock level warnings card" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard Widgets</CardTitle>
        <CardDescription>Customize which widgets appear on your dashboard</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(widgetLabels).map(([key, { title, description }]) => (
          <div key={key} className="flex items-center justify-between space-x-2">
            <div className="flex-1">
              <Label htmlFor={key} className="text-sm font-medium">
                {title}
              </Label>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch
              id={key}
              checked={widgets[key as keyof typeof widgets]}
              onCheckedChange={(checked) => handleToggle(key, checked)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
