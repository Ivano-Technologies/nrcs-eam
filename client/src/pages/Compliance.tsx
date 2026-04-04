import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileCheck, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function Compliance() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    regulatoryBody: "",
    requirementType: "",
    description: "",
    status: "pending" as "compliant" | "non_compliant" | "pending" | "expired",
    dueDate: "",
    completionDate: "",
    nextReviewDate: "",
    assetId: "",
    assignedTo: "",
    documentUrl: "",
    notes: "",
  });

  const utils = trpc.useUtils();
  const { data: records, isLoading } = trpc.compliance.list.useQuery();
  const { data: assets } = trpc.assets.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const createMutation = trpc.compliance.create.useMutation({
    onSuccess: () => {
      toast.success("Compliance record created successfully");
      utils.compliance.list.invalidate();
      setOpen(false);
      setFormData({
        title: "",
        regulatoryBody: "",
        requirementType: "",
        description: "",
        status: "pending",
        dueDate: "",
        completionDate: "",
        nextReviewDate: "",
        assetId: "",
        assignedTo: "",
        documentUrl: "",
        notes: "",
      });
    },
    onError: (error) => {
      toast.error(`Failed to create record: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title) {
      toast.error("Title is required");
      return;
    }

    createMutation.mutate({
      title: formData.title,
      regulatoryBody: formData.regulatoryBody || undefined,
      requirementType: formData.requirementType || undefined,
      description: formData.description || undefined,
      status: formData.status,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      completionDate: formData.completionDate ? new Date(formData.completionDate) : undefined,
      nextReviewDate: formData.nextReviewDate ? new Date(formData.nextReviewDate) : undefined,
      assetId: formData.assetId ? parseInt(formData.assetId) : undefined,
      assignedTo: formData.assignedTo ? parseInt(formData.assignedTo) : undefined,
      documentUrl: formData.documentUrl || undefined,
      notes: formData.notes || undefined,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  const getStatusColor = (status: string) => {
    const colors = { compliant: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100", non_compliant: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100", pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-100", expired: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100" };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compliance Tracking</h1>
          <p className="text-muted-foreground mt-2">Manage regulatory requirements</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Record</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Compliance Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Annual Fire Safety Inspection"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regulatoryBody">Regulatory Body</Label>
                  <Input
                    id="regulatoryBody"
                    value={formData.regulatoryBody}
                    onChange={(e) => setFormData({ ...formData, regulatoryBody: e.target.value })}
                    placeholder="e.g., Fire Service"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requirementType">Requirement Type</Label>
                  <Input
                    id="requirementType"
                    value={formData.requirementType}
                    onChange={(e) => setFormData({ ...formData, requirementType: e.target.value })}
                    placeholder="e.g., Safety, Environmental"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the compliance requirement..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="compliant">Compliant</SelectItem>
                      <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assetId">Related Asset</Label>
                  <Select value={formData.assetId} onValueChange={(value) => setFormData({ ...formData, assetId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset (optional)" />
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
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="completionDate">Completion Date</Label>
                  <Input
                    id="completionDate"
                    type="date"
                    value={formData.completionDate}
                    onChange={(e) => setFormData({ ...formData, completionDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nextReviewDate">Next Review Date</Label>
                  <Input
                    id="nextReviewDate"
                    type="date"
                    value={formData.nextReviewDate}
                    onChange={(e) => setFormData({ ...formData, nextReviewDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Assigned To</Label>
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

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="documentUrl">Document URL</Label>
                  <Input
                    id="documentUrl"
                    value={formData.documentUrl}
                    onChange={(e) => setFormData({ ...formData, documentUrl: e.target.value })}
                    placeholder="Link to compliance document"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Add Record"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {records?.map((record) => (
          <Card key={record.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-primary" />
                  <div><CardTitle className="text-lg">{record.title}</CardTitle>{record.regulatoryBody && <p className="text-xs text-muted-foreground">{record.regulatoryBody}</p>}</div>
                </div>
                <Badge className={getStatusColor(record.status)}>{record.status.replace("_", " ")}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {record.requirementType && <p className="text-muted-foreground"><span className="font-medium">Type:</span> {record.requirementType}</p>}
                {record.dueDate && <div className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-3 w-3" /><span>Due: {new Date(record.dueDate).toLocaleDateString()}</span></div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
