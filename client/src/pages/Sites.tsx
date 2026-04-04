import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Phone, Mail, Upload, Download, Edit2, Save, X } from "lucide-react";
import { useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Sites() {
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: sites, isLoading, refetch } = trpc.sites.list.useQuery();
  
  const downloadTemplateMutation = trpc.bulkOperations.downloadSiteTemplate.useQuery(undefined, { enabled: false });
  const importSitesMutation = trpc.bulkOperations.importSites.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Successfully imported ${result.imported} sites`);
      } else {
        toast.warning(`Imported ${result.imported} sites, ${result.failed} failed`);
      }
      refetch();
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  const createSiteMutation = trpc.sites.create.useMutation({
    onSuccess: () => {
      toast.success("Site created successfully");
      setIsCreateDialogOpen(false);
      refetch();
      setNewSite({ name: "", address: "", city: "", state: "", contactPerson: "", contactPhone: "", contactEmail: "" });
    },
    onError: (error) => {
      toast.error(`Failed to create site: ${error.message}`);
    },
  });

  const updateSiteMutation = trpc.sites.update.useMutation({
    onSuccess: () => {
      toast.success("Site updated successfully");
      setEditingSiteId(null);
      setEditData({});
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update site: ${error.message}`);
    },
  });

  const [newSite, setNewSite] = useState({ name: "", address: "", city: "", state: "", contactPerson: "", contactPhone: "", contactEmail: "" });

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/trpc/bulkOperations.downloadSiteTemplate');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'site_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Template downloaded successfully');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        importSitesMutation.mutate({ fileData: base64.split(',')[1] });
      } catch (error) {
        toast.error('Failed to read file');
      }
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateSite = () => {
    if (!newSite.name) {
      toast.error("Site name is required");
      return;
    }
    createSiteMutation.mutate(newSite);
  };

  const handleStartEdit = (site: any) => {
    setEditingSiteId(site.id);
    setEditData({
      name: site.name,
      address: site.address || "",
      city: site.city || "",
      state: site.state || "",
      contactPerson: site.contactPerson || "",
      contactPhone: site.contactPhone || "",
      contactEmail: site.contactEmail || "",
    });
  };

  const handleSaveEdit = (siteId: number) => {
    if (!editData.name) {
      toast.error("Site name is required");
      return;
    }
    updateSiteMutation.mutate({ id: siteId, ...editData });
  };

  const handleCancelEdit = () => {
    setEditingSiteId(null);
    setEditData({});
  };

  const canManageSites = user?.role === "admin" || user?.role === "manager";

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Sites Management</h1><p className="text-muted-foreground mt-2">Manage organization locations</p></div>
        {canManageSites && (
          <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Site</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Add New Site</DialogTitle><DialogDescription>Create a new site location</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label htmlFor="name">Site Name *</Label><Input id="name" value={newSite.name} onChange={(e) => setNewSite({ ...newSite, name: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="address">Address</Label><Input id="address" value={newSite.address} onChange={(e) => setNewSite({ ...newSite, address: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="city">City</Label><Input id="city" value={newSite.city} onChange={(e) => setNewSite({ ...newSite, city: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="state">State</Label><Input id="state" value={newSite.state} onChange={(e) => setNewSite({ ...newSite, state: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="contactPerson">Contact Person</Label><Input id="contactPerson" value={newSite.contactPerson} onChange={(e) => setNewSite({ ...newSite, contactPerson: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="contactPhone">Phone</Label><Input id="contactPhone" value={newSite.contactPhone} onChange={(e) => setNewSite({ ...newSite, contactPhone: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="contactEmail">Email</Label><Input id="contactEmail" type="email" value={newSite.contactEmail} onChange={(e) => setNewSite({ ...newSite, contactEmail: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateSite} disabled={createSiteMutation.isPending}>{createSiteMutation.isPending ? "Creating..." : "Create Site"}</Button>
              </DialogFooter>
            </DialogContent>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />Template
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </Dialog>
          </div>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sites?.map((site) => (
          <Card key={site.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    {editingSiteId === site.id ? (
                      <Input 
                        value={editData.name} 
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="h-8 text-lg font-semibold"
                      />
                    ) : (
                      <CardTitle className="text-lg">{site.name}</CardTitle>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={site.isActive ? "default" : "secondary"}>{site.isActive ? "Active" : "Inactive"}</Badge>
                  {canManageSites && (
                    editingSiteId === site.id ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(site.id)}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleStartEdit(site)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editingSiteId === site.id ? (
                <div className="space-y-2">
                  <Input 
                    placeholder="Address" 
                    value={editData.address} 
                    onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                    className="text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      placeholder="City" 
                      value={editData.city} 
                      onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                      className="text-sm"
                    />
                    <Input 
                      placeholder="State" 
                      value={editData.state} 
                      onChange={(e) => setEditData({ ...editData, state: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <Input 
                    placeholder="Contact Person" 
                    value={editData.contactPerson} 
                    onChange={(e) => setEditData({ ...editData, contactPerson: e.target.value })}
                    className="text-sm"
                  />
                  <Input 
                    placeholder="Phone" 
                    value={editData.contactPhone} 
                    onChange={(e) => setEditData({ ...editData, contactPhone: e.target.value })}
                    className="text-sm"
                  />
                  <Input 
                    placeholder="Email" 
                    type="email"
                    value={editData.contactEmail} 
                    onChange={(e) => setEditData({ ...editData, contactEmail: e.target.value })}
                    className="text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {site.address && <p className="text-muted-foreground">{site.address}</p>}
                  {(site.city || site.state) && <p className="text-muted-foreground">{[site.city, site.state].filter(Boolean).join(", ")}</p>}
                  {site.contactPerson && <p className="text-muted-foreground"><span className="font-medium">Contact:</span> {site.contactPerson}</p>}
                  {site.contactPhone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /><span>{site.contactPhone}</span></div>}
                  {site.contactEmail && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /><span>{site.contactEmail}</span></div>}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
