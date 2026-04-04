import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, Wrench, Package, AlertTriangle, CheckCircle, RefreshCw, FileText, Info } from "lucide-react";

export default function NotificationPreferences() {
  const { data: preferences, isLoading } = trpc.notifications.getPreferences.useQuery();
  const utils = trpc.useUtils();

  const updatePreferencesMutation = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => {
      utils.notifications.getPreferences.invalidate();
      toast.success("Notification preferences updated");
    },
    onError: () => {
      toast.error("Failed to update preferences");
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    updatePreferencesMutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const notificationTypes = [
    {
      key: "maintenanceDue",
      label: "Maintenance Due",
      description: "Get notified when asset maintenance is due soon",
      icon: Wrench,
      color: "text-orange-600",
    },
    {
      key: "lowStock",
      label: "Low Stock Alerts",
      description: "Receive alerts when inventory items are running low",
      icon: Package,
      color: "text-red-600",
    },
    {
      key: "workOrderAssigned",
      label: "Work Order Assigned",
      description: "Get notified when a work order is assigned to you",
      icon: AlertTriangle,
      color: "text-blue-600",
    },
    {
      key: "workOrderCompleted",
      label: "Work Order Completed",
      description: "Receive notifications when work orders are completed",
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      key: "assetStatusChange",
      label: "Asset Status Changes",
      description: "Get notified when asset status changes",
      icon: RefreshCw,
      color: "text-purple-600",
    },
    {
      key: "complianceDue",
      label: "Compliance Due",
      description: "Receive alerts for upcoming compliance deadlines",
      icon: FileText,
      color: "text-yellow-600",
    },
    {
      key: "systemAlert",
      label: "System Alerts",
      description: "Get important system notifications and announcements",
      icon: Info,
      color: "text-gray-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notification Preferences</h1>
        <p className="text-muted-foreground mt-2">
          Customize which notifications you want to receive
        </p>
      </div>

      <Card className="border-t-4 border-t-primary">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Enable or disable specific notification types
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {notificationTypes.map((type) => {
              const Icon = type.icon;
              const value = preferences?.[type.key as keyof typeof preferences];
              const isEnabled = typeof value === 'boolean' ? value : true;

              return (
                <div
                  key={type.key}
                  className="flex items-start justify-between space-x-4 py-4 border-b last:border-0"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-2 rounded-lg bg-gray-100 ${type.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor={type.key}
                        className="text-base font-medium cursor-pointer"
                      >
                        {type.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {type.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id={type.key}
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(type.key, checked)}
                    disabled={updatePreferencesMutation.isPending}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <p>
                Changes are saved automatically. You can update these preferences at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
