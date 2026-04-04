import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, Calendar, Mail, Clock } from "lucide-react";
import { toast } from "sonner";

export default function ReportScheduling() {
  const utils = trpc.useUtils();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    reportType: "assetInventory" as "assetInventory" | "maintenanceSchedule" | "workOrders" | "financial" | "compliance",
    format: "excel" as "pdf" | "excel",
    schedule: "weekly" as "daily" | "weekly" | "monthly",
    dayOfWeek: "",
    dayOfMonth: "",
    time: "09:00",
    recipients: "",
  });

  const { data: schedules = [], isLoading } = trpc.scheduledReports.list.useQuery();

  const createMutation = trpc.scheduledReports.create.useMutation({
    onSuccess: () => {
      toast.success("Report schedule created successfully");
      utils.scheduledReports.list.invalidate();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Error creating schedule: ${error.message}`);
    },
  });

  const updateMutation = trpc.scheduledReports.update.useMutation({
    onSuccess: () => {
      toast.success("Report schedule updated successfully");
      utils.scheduledReports.list.invalidate();
      setEditingSchedule(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Error updating schedule: ${error.message}`);
    },
  });

  const deleteMutation = trpc.scheduledReports.delete.useMutation({
    onSuccess: () => {
      toast.success("Report schedule deleted successfully");
      utils.scheduledReports.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Error deleting schedule: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      reportType: "assetInventory",
      format: "excel",
      schedule: "weekly",
      dayOfWeek: "",
      dayOfMonth: "",
      time: "09:00",
      recipients: "",
    });
  };

  const handleCreate = () => {
    createMutation.mutate({
      name: formData.name,
      reportType: formData.reportType,
      format: formData.format,
      schedule: formData.schedule,
      dayOfWeek: formData.dayOfWeek ? parseInt(formData.dayOfWeek) : undefined,
      dayOfMonth: formData.dayOfMonth ? parseInt(formData.dayOfMonth) : undefined,
      time: formData.time,
      recipients: formData.recipients,
    });
  };

  const handleUpdate = () => {
    if (!editingSchedule) return;

    updateMutation.mutate({
      id: editingSchedule.id,
      name: formData.name,
      reportType: formData.reportType,
      format: formData.format,
      schedule: formData.schedule,
      dayOfWeek: formData.dayOfWeek ? parseInt(formData.dayOfWeek) : undefined,
      dayOfMonth: formData.dayOfMonth ? parseInt(formData.dayOfMonth) : undefined,
      time: formData.time,
      recipients: formData.recipients,
    });
  };

  const handleEdit = (schedule: any) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      reportType: schedule.reportType,
      format: schedule.format,
      schedule: schedule.schedule,
      dayOfWeek: schedule.dayOfWeek?.toString() || "",
      dayOfMonth: schedule.dayOfMonth?.toString() || "",
      time: schedule.time || "09:00",
      recipients: schedule.recipients || "",
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this report schedule?")) {
      deleteMutation.mutate({ id });
    }
  };

  const getScheduleDescription = (schedule: any) => {
    if (schedule.schedule === "daily") {
      return `Daily at ${schedule.time}`;
    } else if (schedule.schedule === "weekly") {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return `Weekly on ${days[schedule.dayOfWeek || 0]} at ${schedule.time}`;
    } else {
      return `Monthly on day ${schedule.dayOfMonth} at ${schedule.time}`;
    }
  };

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      assetInventory: "Asset Inventory",
      maintenanceSchedule: "Maintenance Schedule",
      workOrders: "Work Orders",
      financial: "Financial",
      compliance: "Compliance",
    };
    return labels[type] || type;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Report Scheduling</h1>
          <p className="text-muted-foreground">Automate report generation and email delivery</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading schedules...</div>
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No scheduled reports yet. Create your first schedule to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((schedule: any) => (
            <Card key={schedule.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <span className="text-lg">{schedule.name}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(schedule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(schedule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {getReportTypeLabel(schedule.reportType)}
                    </span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      {schedule.format.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{getScheduleDescription(schedule)}</span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 mt-0.5" />
                    <span className="text-xs break-all">{schedule.recipients}</span>
                  </div>
                  {schedule.lastRun && (
                    <p className="text-xs text-muted-foreground">
                      Last run: {new Date(schedule.lastRun).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateDialogOpen || !!editingSchedule} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setEditingSchedule(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? "Edit Schedule" : "Create New Schedule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Schedule Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Weekly Asset Report"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reportType">Report Type *</Label>
                <Select value={formData.reportType} onValueChange={(value: any) => setFormData({ ...formData, reportType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assetInventory">Asset Inventory</SelectItem>
                    <SelectItem value="maintenanceSchedule">Maintenance Schedule</SelectItem>
                    <SelectItem value="workOrders">Work Orders</SelectItem>
                    <SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="format">Format *</Label>
                <Select value={formData.format} onValueChange={(value: any) => setFormData({ ...formData, format: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="schedule">Schedule *</Label>
              <Select value={formData.schedule} onValueChange={(value: any) => setFormData({ ...formData, schedule: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.schedule === "weekly" && (
              <div>
                <Label htmlFor="dayOfWeek">Day of Week *</Label>
                <Select value={formData.dayOfWeek} onValueChange={(value) => setFormData({ ...formData, dayOfWeek: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.schedule === "monthly" && (
              <div>
                <Label htmlFor="dayOfMonth">Day of Month (1-31) *</Label>
                <Input
                  id="dayOfMonth"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dayOfMonth}
                  onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })}
                  placeholder="e.g., 1"
                />
              </div>
            )}

            <div>
              <Label htmlFor="time">Time (HH:MM) *</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="recipients">Recipients (comma-separated emails) *</Label>
              <Input
                id="recipients"
                value={formData.recipients}
                onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                placeholder="email1@example.com, email2@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setEditingSchedule(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={editingSchedule ? handleUpdate : handleCreate}
              disabled={!formData.name || !formData.recipients || createMutation.isPending || updateMutation.isPending}
            >
              {editingSchedule ? "Update" : "Create"} Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
