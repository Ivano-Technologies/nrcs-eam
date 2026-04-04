import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function WorkOrderDetail() {
  const [, params] = useRoute("/work-orders/:id");
  const [, setLocation] = useLocation();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const workOrderId = params?.id ? Number(params.id) : 0;
  const { data: workOrder, isLoading, refetch } = trpc.workOrders.getById.useQuery({ id: workOrderId });

  const updateMutation = trpc.workOrders.update.useMutation({
    onSuccess: () => {
      toast.success("Work order updated");
      setIsEditDialogOpen(false);
      refetch();
    },
  });

  const [editForm, setEditForm] = useState({ status: "", completionNotes: "" });

  const handleEdit = () => {
    if (workOrder) {
      setEditForm({ status: workOrder.status, completionNotes: workOrder.completionNotes || "" });
      setIsEditDialogOpen(true);
    }
  };

  if (isLoading || !workOrder) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/work-orders")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-3xl font-bold">{workOrder.title}</h1>
            <p className="text-muted-foreground">{workOrder.workOrderNumber}</p>
          </div>
        </div>
        <Button onClick={handleEdit}><Edit className="mr-2 h-4 w-4" />Edit</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Work Order Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><p className="text-sm font-medium text-muted-foreground">Status</p><Badge>{workOrder.status}</Badge></div>
          <div><p className="text-sm font-medium text-muted-foreground">Priority</p><Badge>{workOrder.priority}</Badge></div>
          <div><p className="text-sm font-medium text-muted-foreground">Type</p><p>{workOrder.type}</p></div>
          {workOrder.description && <div><p className="text-sm font-medium text-muted-foreground">Description</p><p>{workOrder.description}</p></div>}
        </CardContent>
      </Card>
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Work Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({...editForm, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Completion Notes</Label><Textarea value={editForm.completionNotes} onChange={(e) => setEditForm({...editForm, completionNotes: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate({ id: workOrderId, status: editForm.status as any, completionNotes: editForm.completionNotes })}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
