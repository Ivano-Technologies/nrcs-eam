import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Wrench, AlertCircle, CheckCircle } from "lucide-react";

interface AssetMaintenanceTimelineProps {
  assetId: number;
}

export function AssetMaintenanceTimeline({ assetId }: AssetMaintenanceTimelineProps) {
  const { data: allWorkOrders, isLoading } = trpc.workOrders.list.useQuery({});
  const { data: allSchedules } = trpc.maintenance.list.useQuery({});
  
  const workOrders = allWorkOrders?.filter(wo => wo.assetId === assetId) || [];
  const schedules = allSchedules?.filter(s => s.assetId === assetId) || [];

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg"></div>;
  }

  const timelineEvents = [
    ...(workOrders || []).map((wo: any) => ({
      id: `wo-${wo.id}`,
      type: "work_order" as const,
      title: wo.title,
      description: wo.description,
      date: new Date(wo.createdAt),
      status: wo.status,
    })),
    ...(schedules || []).map((schedule: any) => ({
      id: `schedule-${schedule.id}`,
      type: "maintenance" as const,
      title: `${schedule.maintenanceType} Maintenance`,
      description: schedule.description || "",
      date: new Date(schedule.nextDueDate),
      status: schedule.status,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const getIcon = (type: string) => {
    if (type === "work_order") return <Wrench className="h-4 w-4" />;
    return <Calendar className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: "bg-green-100 text-green-800",
      "in-progress": "bg-blue-100 text-blue-800",
      pending: "bg-yellow-100 text-yellow-800",
      scheduled: "bg-purple-100 text-purple-800",
      overdue: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Maintenance History & Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {timelineEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No maintenance history or scheduled events</p>
          </div>
        ) : (
          <div className="space-y-4">
            {timelineEvents.map((event, index) => (
              <div key={event.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {getIcon(event.type)}
                  </div>
                  {index < timelineEvents.length - 1 && (
                    <div className="h-full w-px bg-border mt-2"></div>
                  )}
                </div>
                <div className="flex-1 pb-8">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{event.title}</h4>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {event.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {event.date.toLocaleDateString()} at {event.date.toLocaleTimeString()}
                      </p>
                    </div>
                    <Badge className={getStatusColor(event.status)}>
                      {event.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
