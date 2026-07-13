import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

const DEFAULT_WIDGETS = {
  kpiCards: true,
  stockMovement: true,
  attentionPanel: true,
  activityFeed: true,
  facilityStatus: true,
  requisitionsTable: true,
  fleetHealth: true,
};

export function DashboardWidgetSettings() {
  const { user } = useAuth();
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
    kpiCards: { title: "KPI Cards", description: "Show top-level metric cards" },
    stockMovement: { title: "Stock Movement", description: "Show stock movement chart" },
    attentionPanel: { title: "Attention Panel", description: "Show role-based action items" },
    activityFeed: { title: "Activity Feed", description: "Show recent system activity" },
    facilityStatus: { title: "Facility Status", description: "Show facility readiness list" },
    requisitionsTable: { title: "Requisitions", description: "Show pending requisitions summary" },
    fleetHealth: { title: "Fleet health", description: "Book value, predictions, and overdue work orders" },
  };

  if (user?.role === "staff" || user?.role === "field") {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[#1a2332] dark:text-[hsl(0_0%_95%)]">Dashboard Widgets</CardTitle>
        <CardDescription className="text-[#334155] dark:text-[hsl(0_0%_95%)]">Customize which widgets appear on your dashboard</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(widgetLabels).map(([key, { title, description }]) => (
          <div key={key} className="flex items-center justify-between space-x-2">
            <div className="flex-1">
              <Label htmlFor={key} className="text-sm font-medium text-[#1a2332] dark:text-[hsl(0_0%_95%)]">
                {title}
              </Label>
              <p className="text-xs text-[#334155] dark:text-[hsl(0_0%_95%)]">{description}</p>
            </div>
            <Switch
              id={key}
              data-testid={`settings-widget-${key}`}
              checked={widgets[key as keyof typeof widgets]}
              onCheckedChange={(checked) => handleToggle(key, checked)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
