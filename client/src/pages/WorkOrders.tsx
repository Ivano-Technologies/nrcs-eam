import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Wrench, Calendar } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function WorkOrders() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: workOrders, isLoading, refetch } = trpc.workOrders.list.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const { data: assets } = trpc.assets.list.useQuery();
  const { data: sites } = trpc.sites.list.useQuery();
  const { data: users } = trpc.users.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const createWorkOrderMutation = trpc.workOrders.create.useMutation({
    onSuccess: () => {
      toast.success("Work order created successfully");
      setIsCreateDialogOpen(false);
      refetch();
      setNewWorkOrder({
        workOrderNumber: "",
        title: "",
        description: "",
        assetId: "",
        siteId: "",
        type: "corrective",
        priority: "medium",
        assignedTo: "",
      });
    },
    onError: (error) => {
      toast.error(`Failed to create work order: ${error.message}`);
    },
  });

  const [newWorkOrder, setNewWorkOrder] = useState({
    workOrderNumber: "",
    title: "",
    description: "",
    assetId: "",
    siteId: "",
    type: "corrective" as const,
    priority: "medium" as const,
    assignedTo: "",
  });

  const handleCreateWorkOrder = () => {
    if (!newWorkOrder.workOrderNumber || !newWorkOrder.title || !newWorkOrder.assetId || !newWorkOrder.siteId) {
      toast.error("Please fill in all required fields");
      return;
    }

    createWorkOrderMutation.mutate({
      workOrderNumber: newWorkOrder.workOrderNumber,
      title: newWorkOrder.title,
      description: newWorkOrder.description || undefined,
      assetId: Number(newWorkOrder.assetId),
      siteId: Number(newWorkOrder.siteId),
      type: newWorkOrder.type,
      priority: newWorkOrder.priority,
      assignedTo: newWorkOrder.assignedTo ? Number(newWorkOrder.assignedTo) : undefined,
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      assigned: "bg-blue-100 text-blue-800",
      in_progress: "bg-purple-100 text-purple-800",
      on_hold: "bg-orange-100 text-orange-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      critical: "bg-red-100 text-red-800",
    };
    return colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Work Orders</h1>
          <p className="text-muted-foreground mt-2">
            Manage maintenance and repair work orders
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Work Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Work Order</DialogTitle>
              <DialogDescription>
                Create a new maintenance or repair work order
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workOrderNumber">Work Order Number *</Label>
                  <Input
                    id="workOrderNumber"
                    value={newWorkOrder.workOrderNumber}
                    onChange={(e) => setNewWorkOrder({ ...newWorkOrder, workOrderNumber: e.target.value })}
                    placeholder="e.g., WO-2024-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newWorkOrder.title}
                    onChange={(e) => setNewWorkOrder({ ...newWorkOrder, title: e.target.value })}
                    placeholder="Brief description"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newWorkOrder.description}
                  onChange={(e) => setNewWorkOrder({ ...newWorkOrder, description: e.target.value })}
                  placeholder="Detailed work order description..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="asset">Asset *</Label>
                  <Select value={newWorkOrder.assetId} onValueChange={(value) => setNewWorkOrder({ ...newWorkOrder, assetId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {assets?.map((asset) => (
                        <SelectItem key={asset.id} value={asset.id.toString()}>
                          {asset.name} ({asset.assetTag})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site">Site *</Label>
                  <Select value={newWorkOrder.siteId} onValueChange={(value) => setNewWorkOrder({ ...newWorkOrder, siteId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites?.map((site) => (
                        <SelectItem key={site.id} value={site.id.toString()}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={newWorkOrder.type} onValueChange={(value: any) => setNewWorkOrder({ ...newWorkOrder, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrective">Corrective</SelectItem>
                      <SelectItem value="preventive">Preventive</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={newWorkOrder.priority} onValueChange={(value: any) => setNewWorkOrder({ ...newWorkOrder, priority: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {user?.role === "admin" && users && (
                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Assign To</Label>
                  <Select value={newWorkOrder.assignedTo} onValueChange={(value) => setNewWorkOrder({ ...newWorkOrder, assignedTo: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id.toString()}>
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateWorkOrder} disabled={createWorkOrderMutation.isPending}>
                {createWorkOrderMutation.isPending ? "Creating..." : "Create Work Order"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : workOrders && workOrders.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workOrders.map((wo) => (
            <Link key={wo.id} href={`/work-orders/${wo.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{wo.title}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {wo.workOrderNumber}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Badge className={getStatusColor(wo.status)}>
                        {wo.status.replace("_", " ")}
                      </Badge>
                      <Badge className={getPriorityColor(wo.priority)}>
                        {wo.priority}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      <span className="font-medium">Type:</span> {wo.type}
                    </p>
                    {wo.scheduledStart && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(wo.scheduledStart).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No work orders found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
