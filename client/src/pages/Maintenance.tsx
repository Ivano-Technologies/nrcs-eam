import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function Maintenance() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    assetId: "",
    frequency: "monthly" as "daily" | "weekly" | "monthly" | "quarterly" | "semi_annual" | "annual",
    frequencyValue: "1",
    nextDue: "",
    assignedTo: "",
    taskTemplate: "",
    estimatedDuration: "",
  });

  const utils = trpc.useUtils();
  const { data: schedules, isLoading } = trpc.maintenance.list.useQuery();
  const { data: upcoming } = trpc.maintenance.upcoming.useQuery({ days: 30 });
  const { data: assets } = trpc.assets.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const createMutation = trpc.maintenance.create.useMutation({
    onSuccess: () => {
      toast.success("Maintenance schedule created successfully");
      utils.maintenance.list.invalidate();
      utils.maintenance.upcoming.invalidate();
      setOpen(false);
      setFormData({
        name: "",
        description: "",
        assetId: "",
        frequency: "monthly",
        frequencyValue: "1",
        nextDue: "",
        assignedTo: "",
        taskTemplate: "",
        estimatedDuration: "",
      });
    },
    onError: (error) => {
      toast.error(`Failed to create schedule: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.assetId || !formData.nextDue) {
      toast.error("Please fill in all required fields");
      return;
    }

    createMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      assetId: parseInt(formData.assetId),
      frequency: formData.frequency,
      frequencyValue: parseInt(formData.frequencyValue),
      nextDue: new Date(formData.nextDue),
      assignedTo: formData.assignedTo ? parseInt(formData.assignedTo) : undefined,
      taskTemplate: formData.taskTemplate || undefined,
      estimatedDuration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : undefined,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Preventive Maintenance</h1>
          <p className="text-muted-foreground mt-2">Manage maintenance schedules</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Schedule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Maintenance Schedule</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">Schedule Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Generator Monthly Service"
                    required
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the maintenance tasks..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assetId">Asset *</Label>
                  <Select value={formData.assetId} onValueChange={(value) => setFormData({ ...formData, assetId: value })}>
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
                  <Label htmlFor="frequency">Frequency *</Label>
                  <Select value={formData.frequency} onValueChange={(value: any) => setFormData({ ...formData, frequency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="frequencyValue">Frequency Value</Label>
                  <Input
                    id="frequencyValue"
                    type="number"
                    min="1"
                    value={formData.frequencyValue}
                    onChange={(e) => setFormData({ ...formData, frequencyValue: e.target.value })}
                    placeholder="e.g., 1"
                  />
                  <p className="text-xs text-muted-foreground">How often (e.g., every 2 months)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nextDue">Next Due Date *</Label>
                  <Input
                    id="nextDue"
                    type="date"
                    value={formData.nextDue}
                    onChange={(e) => setFormData({ ...formData, nextDue: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Assign To</Label>
                  <Select value={formData.assignedTo} onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimatedDuration">Estimated Duration (minutes)</Label>
                  <Input
                    id="estimatedDuration"
                    type="number"
                    min="0"
                    value={formData.estimatedDuration}
                    onChange={(e) => setFormData({ ...formData, estimatedDuration: e.target.value })}
                    placeholder="e.g., 120"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="taskTemplate">Task Checklist</Label>
                  <Textarea
                    id="taskTemplate"
                    value={formData.taskTemplate}
                    onChange={(e) => setFormData({ ...formData, taskTemplate: e.target.value })}
                    placeholder="Enter tasks, one per line..."
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Schedule"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Upcoming Maintenance (Next 30 Days)</CardTitle></CardHeader>
        <CardContent>
          {upcoming && upcoming.length > 0 ? (
            <div className="space-y-3">
              {upcoming.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div><p className="font-medium">{s.name}</p><p className="text-sm text-muted-foreground">Due: {new Date(s.nextDue).toLocaleDateString()}</p></div>
                  <Badge>{s.frequency}</Badge>
                </div>
              ))}
            </div>
          ) : <p className="text-muted-foreground">No upcoming maintenance scheduled</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Schedules</CardTitle></CardHeader>
        <CardContent>
          {schedules && schedules.length > 0 ? (
            <div className="space-y-3">
              {schedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div><p className="font-medium">{s.name}</p><p className="text-sm text-muted-foreground">{s.description}</p></div>
                  <div className="flex gap-2"><Badge>{s.frequency}</Badge><Badge variant={s.isActive ? "default" : "secondary"}>{s.isActive ? "Active" : "Inactive"}</Badge></div>
                </div>
              ))}
            </div>
          ) : <p className="text-muted-foreground">No schedules found</p>}
        </CardContent>
      </Card>
    </div>
  );
}
