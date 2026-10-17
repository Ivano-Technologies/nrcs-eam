import { formatEnumLabel } from "@/lib/format";
import { Wrench } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, AlertCircle, XCircle, ChevronRight, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { appPath } from "@/lib/routes";
import { useConnectivity } from "@/hooks/useConnectivity";
import { STATUS_TONE_BADGE_CLASS } from "@/lib/statusTone";

export default function MobileWorkOrders() {
  const [, setLocation] = useLocation();
  const { isOnline } = useConnectivity();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: workOrders = [], isLoading, refetch } = trpc.workOrders.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const updateStatusMutation = trpc.workOrders.update.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      refetch();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-muted-foreground" />;
      case "pending":
        return <AlertCircle className="h-5 w-5 text-warning-foreground" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-danger dark:text-primary-on-dark" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return STATUS_TONE_BADGE_CLASS.success;
      case "in_progress":
        return "border-border bg-secondary text-secondary-foreground";
      case "pending":
        return STATUS_TONE_BADGE_CLASS.warning;
      case "cancelled":
        return STATUS_TONE_BADGE_CLASS.danger;
      default:
        return "border-border bg-secondary text-secondary-foreground";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return STATUS_TONE_BADGE_CLASS.danger;
      case "high":
        return STATUS_TONE_BADGE_CLASS.warning;
      case "medium":
        return "border-border bg-secondary text-secondary-foreground";
      case "low":
        return "border-border bg-secondary text-secondary-foreground";
      default:
        return "border-border bg-secondary text-secondary-foreground";
    }
  };

  const quickStatusUpdate = (id: number, newStatus: string) => {
    updateStatusMutation.mutate({ id, status: newStatus as any });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-sunken p-4">
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-sunken">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="p-4">
          <h1 className="text-2xl font-bold">Work orders</h1>
          <p className="text-sm text-muted-foreground">Mobile view</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex overflow-x-auto px-4 pb-3 gap-2">
          {["all", "pending", "in_progress", "completed"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="whitespace-nowrap"
            >
              {formatEnumLabel(status)}
            </Button>
          ))}
        </div>
      </div>

      {/* Work Orders List */}
      <div className="p-4 space-y-3">
        {workOrders.length === 0 ? (
          <Card>
            <EmptyState icon={Wrench} title="No work orders yet" />
          </Card>
        ) : (
          workOrders.map((wo: any) => (
            <Card size="sm"
              key={wo.id}
              className="cursor-pointer active:scale-98 transition-transform"
              onClick={() => setLocation(appPath(`/mobile-work-order/${wo.id}`))}
            >
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(wo.status)}
                      <h3 className="font-semibold text-lg">{wo.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {wo.description || "No description"}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge className={getStatusColor(wo.status)}>
                    {formatEnumLabel(wo.status)}
                  </Badge>
                  <Badge className={getPriorityColor(wo.priority)} variant="outline">
                    {formatEnumLabel(wo.priority)}
                  </Badge>
                </div>

                {wo.status === "pending" && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        quickStatusUpdate(wo.id, "in_progress");
                      }}
                    >
                      Start work
                    </Button>
                  </div>
                )}

                {wo.status === "in_progress" && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={!isOnline}
                      title={!isOnline ? "Photos need a connection" : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isOnline) {
                          toast.error("Photos need a connection");
                          return;
                        }
                        setLocation(appPath(`/mobile-work-order/${wo.id}?takePhoto=1`));
                      }}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Photo
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        quickStatusUpdate(wo.id, "completed");
                      }}
                    >
                      Complete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
