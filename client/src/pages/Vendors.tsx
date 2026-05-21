import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Plus, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function Vendors() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    vendorCode: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "Nigeria",
    website: "",
    notes: "",
  });

  const utils = trpc.useUtils();
  const { data: vendors, isLoading } = trpc.vendors.list.useQuery();

  const createMutation = trpc.vendors.create.useMutation({
    onSuccess: () => {
      toast.success("Vendor created successfully");
      utils.vendors.list.invalidate();
      setOpen(false);
      setFormData({
        name: "",
        vendorCode: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        country: "Nigeria",
        website: "",
        notes: "",
      });
    },
    onError: (error) => {
      toast.error(`Failed to create vendor: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error("Vendor name is required");
      return;
    }

    createMutation.mutate({
      name: formData.name,
      vendorCode: formData.vendorCode || undefined,
      contactPerson: formData.contactPerson || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      country: formData.country || undefined,
      website: formData.website || undefined,
      notes: formData.notes || undefined,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendor Management</h1>
          <p className="text-muted-foreground mt-2">Manage suppliers and contractors</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Vendor</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Vendor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Vendor Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., ABC Supplies Ltd"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendorCode">Vendor Code</Label>
                  <Input
                    id="vendorCode"
                    value={formData.vendorCode}
                    onChange={(e) => setFormData({ ...formData, vendorCode: e.target.value })}
                    placeholder="e.g., VEN-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="Full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="vendor@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+234 xxx xxx xxxx"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g., Lagos"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g., Lagos State"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional information about this vendor..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Add Vendor"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vendors?.map((vendor) => (
          <Card key={vendor.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div><CardTitle className="text-lg">{vendor.name}</CardTitle>{vendor.vendorCode && <p className="text-xs text-muted-foreground">{vendor.vendorCode}</p>}</div>
                </div>
                <Badge variant={vendor.isActive ? "default" : "secondary"}>{vendor.isActive ? "Active" : "Inactive"}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {vendor.contactPerson && <p className="text-muted-foreground"><span className="font-medium">Contact:</span> {vendor.contactPerson}</p>}
                {vendor.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /><span>{vendor.email}</span></div>}
                {vendor.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /><span>{vendor.phone}</span></div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
