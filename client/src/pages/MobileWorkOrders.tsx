import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, AlertCircle, XCircle, ChevronRight, Camera } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function MobileWorkOrders() {
  const [, setLocation] = useLocation();
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
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-blue-600" />;
      case "pending":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const quickStatusUpdate = (id: number, newStatus: string) => {
    updateStatusMutation.mutate({ id, status: newStatus as any });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="text-center py-8">Loading work orders...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4">
          <h1 className="text-2xl font-bold">Work Orders</h1>
          <p className="text-sm text-muted-foreground">Mobile View</p>
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
              {status.replace("_", " ").toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* Work Orders List */}
      <div className="p-4 space-y-3">
        {workOrders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No work orders found
            </CardContent>
          </Card>
        ) : (
          workOrders.map((wo: any) => (
            <Card
              key={wo.id}
              className="cursor-pointer active:scale-98 transition-transform"
              onClick={() => setLocation(`/mobile-work-order/${wo.id}`)}
            >
              <CardContent className="p-4">
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
                    {wo.status.replace("_", " ")}
                  </Badge>
                  <Badge className={getPriorityColor(wo.priority)} variant="outline">
                    {wo.priority}
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
                      Start Work
                    </Button>
                  </div>
                )}

                {wo.status === "in_progress" && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open camera for photo
                        toast.info("Camera feature coming soon");
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
