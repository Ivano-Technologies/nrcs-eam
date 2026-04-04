import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Edit, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

export default function WorkOrderTemplates() {

  const utils = trpc.useUtils();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "preventive" as "corrective" | "preventive" | "inspection" | "emergency",
    priority: "medium" as "low" | "medium" | "high" | "critical",
    estimatedDuration: "",
    instructions: "",
    checklistItems: "",
  });

  const { data: templates = [], isLoading } = trpc.workOrderTemplates.list.useQuery({
    isActive: true,
  });

  const createMutation = trpc.workOrderTemplates.create.useMutation({
    onSuccess: () => {
      toast.success("Template created successfully");
      utils.workOrderTemplates.list.invalidate();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Error creating template: ${error.message}`);
    },
  });

  const updateMutation = trpc.workOrderTemplates.update.useMutation({
    onSuccess: () => {
      toast.success("Template updated successfully");
      utils.workOrderTemplates.list.invalidate();
      setEditingTemplate(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Error updating template: ${error.message}`);
    },
  });

  const deleteMutation = trpc.workOrderTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success("Template deleted successfully");
      utils.workOrderTemplates.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Error deleting template: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "preventive",
      priority: "medium",
      estimatedDuration: "",
      instructions: "",
      checklistItems: "",
    });
  };

  const handleCreate = () => {
    const checklistArray = formData.checklistItems
      .split("\n")
      .filter(item => item.trim())
      .map(item => ({ text: item.trim(), completed: false }));

    createMutation.mutate({
      name: formData.name,
      description: formData.description,
      type: formData.type,
      priority: formData.priority,
      estimatedDuration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : undefined,
      instructions: formData.instructions,
      checklistItems: JSON.stringify(checklistArray),
    });
  };

  const handleUpdate = () => {
    if (!editingTemplate) return;

    const checklistArray = formData.checklistItems
      .split("\n")
      .filter(item => item.trim())
      .map(item => ({ text: item.trim(), completed: false }));

    updateMutation.mutate({
      id: editingTemplate.id,
      name: formData.name,
      description: formData.description,
      type: formData.type,
      priority: formData.priority,
      estimatedDuration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : undefined,
      instructions: formData.instructions,
      checklistItems: JSON.stringify(checklistArray),
    });
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    
    let checklistText = "";
    if (template.checklistItems) {
      try {
        const items = JSON.parse(template.checklistItems);
        checklistText = items.map((item: any) => item.text || item).join("\n");
      } catch {
        checklistText = template.checklistItems;
      }
    }

    setFormData({
      name: template.name,
      description: template.description || "",
      type: template.type,
      priority: template.priority,
      estimatedDuration: template.estimatedDuration?.toString() || "",
      instructions: template.instructions || "",
      checklistItems: checklistText,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Work Order Templates</h1>
          <p className="text-muted-foreground">Create reusable templates for common maintenance tasks</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading templates...</div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No templates yet. Create your first template to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template: any) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <span className="text-lg">{template.name}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{template.description}</p>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {template.type}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      template.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      template.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      template.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {template.priority}
                    </span>
                  </div>
                  {template.estimatedDuration && (
                    <p className="text-xs">Est. Duration: {template.estimatedDuration} min</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateDialogOpen || !!editingTemplate} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setEditingTemplate(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Create New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Generator Monthly Service"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this maintenance task"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type *</Label>
                <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventive">Preventive</SelectItem>
                    <SelectItem value="corrective">Corrective</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">Priority *</Label>
                <Select value={formData.priority} onValueChange={(value: any) => setFormData({ ...formData, priority: value })}>
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

            <div>
              <Label htmlFor="duration">Estimated Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.estimatedDuration}
                onChange={(e) => setFormData({ ...formData, estimatedDuration: e.target.value })}
                placeholder="e.g., 120"
              />
            </div>

            <div>
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="Detailed step-by-step instructions"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="checklist">Checklist Items (one per line)</Label>
              <Textarea
                id="checklist"
                value={formData.checklistItems}
                onChange={(e) => setFormData({ ...formData, checklistItems: e.target.value })}
                placeholder="Check oil level&#10;Inspect belts&#10;Test emergency shutdown"
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setEditingTemplate(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={editingTemplate ? handleUpdate : handleCreate}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
            >
              {editingTemplate ? "Update" : "Create"} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
