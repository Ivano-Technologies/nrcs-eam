import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Plus,
  Phone,
  Mail,
  Upload,
  Download,
  Edit2,
  Save,
  X,
  Package,
  Boxes,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { appPath } from "@/lib/routes";
import {
  FACILITY_TYPE_EXAMPLES,
  FACILITY_TYPE_LABELS,
  FACILITY_TYPE_VALUES,
  type FacilityType,
} from "@shared/facilities";
import { cn } from "@/lib/utils";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type FacilityListItem = inferRouterOutputs<AppRouter>["sites"]["list"][number];

type TabValue = "all" | FacilityType;

const TYPE_BADGE: Record<FacilityType, string> = {
  branch: "bg-blue-600/15 text-blue-800 border-blue-200 dark:text-blue-200",
  division: "bg-violet-600/15 text-violet-800 border-violet-200 dark:text-violet-200",
  clinic: "bg-emerald-600/15 text-emerald-800 border-emerald-200 dark:text-emerald-200",
  warehouse: "bg-amber-600/15 text-amber-900 border-amber-200 dark:text-amber-100",
};

type NewFacilityForm = {
  name: string;
  facilityType: FacilityType;
  parentFacilityId: string;
  address: string;
  city: string;
  state: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
};

const emptyNewFacility = (): NewFacilityForm => ({
  name: "",
  facilityType: "branch",
  parentFacilityId: "",
  address: "",
  city: "",
  state: "",
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
});

export default function Facilities() {
  const { canEditFacilities } = usePermissions();
  const [tab, setTab] = useState<TabValue>("all");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: facilities, isLoading, refetch } = trpc.sites.list.useQuery();

  const importSitesMutation = trpc.bulkOperations.importSites.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Successfully imported ${result.imported} facilities`);
      } else {
        toast.warning(`Imported ${result.imported} facilities, ${result.failed} failed`);
      }
      refetch();
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  const createSiteMutation = trpc.sites.create.useMutation({
    onSuccess: () => {
      toast.success("Facility created successfully");
      setIsCreateDialogOpen(false);
      refetch();
      setNewFacility(emptyNewFacility());
    },
    onError: (error) => {
      toast.error(`Failed to create facility: ${error.message}`);
    },
  });

  const updateSiteMutation = trpc.sites.update.useMutation({
    onSuccess: () => {
      toast.success("Facility updated successfully");
      setEditingSiteId(null);
      setEditData({});
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update facility: ${error.message}`);
    },
  });

  const [newFacility, setNewFacility] = useState<NewFacilityForm>(emptyNewFacility());

  const branchOptions = useMemo(() => {
    if (!facilities) return [];
    return facilities.filter((f) => f.facilityType === "branch");
  }, [facilities]);

  const stateOptions = useMemo(() => {
    if (!facilities) return [];
    const set = new Set<string>();
    for (const f of facilities) {
      if (f.state?.trim()) set.add(f.state.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [facilities]);

  const filteredFacilities = useMemo(() => {
    if (!facilities) return [];
    return facilities.filter((f) => {
      if (tab !== "all" && f.facilityType !== tab) return false;
      if (stateFilter !== "all" && (f.state?.trim() || "") !== stateFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!f.name.toLowerCase().includes(q) && !(f.address ?? "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [facilities, tab, stateFilter, search]);

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/trpc/bulkOperations.downloadSiteTemplate");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "facility_import_template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Template downloaded successfully");
    } catch {
      toast.error("Failed to download template");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        importSitesMutation.mutate({ fileData: base64.split(",")[1] });
      } catch {
        toast.error("Failed to read file");
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCreateFacility = () => {
    if (!newFacility.name.trim()) {
      toast.error("Facility name is required");
      return;
    }
    if (newFacility.facilityType === "clinic" || newFacility.facilityType === "warehouse") {
      if (!newFacility.parentFacilityId) {
        toast.error("Select a parent branch for this facility type");
        return;
      }
    }
    createSiteMutation.mutate({
      name: newFacility.name.trim(),
      facilityType: newFacility.facilityType,
      parentFacilityId:
        newFacility.facilityType === "clinic" || newFacility.facilityType === "warehouse"
          ? Number(newFacility.parentFacilityId)
          : null,
      address: newFacility.address || undefined,
      city: newFacility.city || undefined,
      state: newFacility.state || undefined,
      contactPerson: newFacility.contactPerson || undefined,
      contactPhone: newFacility.contactPhone || undefined,
      contactEmail: newFacility.contactEmail || undefined,
    });
  };

  const handleStartEdit = (site: FacilityListItem) => {
    setEditingSiteId(site.id);
    setEditData({
      name: site.name,
      facilityType: site.facilityType,
      parentFacilityId:
        site.parentFacilityId != null ? String(site.parentFacilityId) : "",
      address: site.address || "",
      city: site.city || "",
      state: site.state || "",
      contactPerson: site.contactPerson || "",
      contactPhone: site.contactPhone || "",
      contactEmail: site.contactEmail || "",
    });
  };

  const handleSaveEdit = (siteId: number) => {
    if (!editData.name || String(editData.name).trim() === "") {
      toast.error("Facility name is required");
      return;
    }
    const facilityType = editData.facilityType as FacilityType;
    if ((facilityType === "clinic" || facilityType === "warehouse") && !editData.parentFacilityId) {
      toast.error("Select a parent branch for this facility type");
      return;
    }
    updateSiteMutation.mutate({
      id: siteId,
      name: String(editData.name).trim(),
      facilityType,
      parentFacilityId:
        facilityType === "clinic" || facilityType === "warehouse"
          ? Number(editData.parentFacilityId)
          : null,
      address: String(editData.address || ""),
      city: String(editData.city || ""),
      state: String(editData.state || ""),
      contactPerson: String(editData.contactPerson || ""),
      contactPhone: String(editData.contactPhone || ""),
      contactEmail: String(editData.contactEmail || "") || undefined,
    });
  };

  const handleCancelEdit = () => {
    setEditingSiteId(null);
    setEditData({});
  };

  const canManageFacilities = canEditFacilities;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Facilities Management</h1>
          <p className="mt-2 text-muted-foreground">
            Manage branches, divisions, clinics, and warehouses
          </p>
        </div>
        {canManageFacilities && (
          <div className="flex flex-wrap gap-2">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add facility
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add facility</DialogTitle>
                  <DialogDescription>Create a new facility record</DialogDescription>
                </DialogHeader>
                <div className="grid max-h-[70vh] gap-4 overflow-y-auto py-4">
                  <div className="space-y-2">
                    <Label htmlFor="nf-name">Facility name *</Label>
                    <Input
                      id="nf-name"
                      value={newFacility.name}
                      onChange={(e) => setNewFacility({ ...newFacility, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Facility type</Label>
                    <Select
                      value={newFacility.facilityType}
                      onValueChange={(v) =>
                        setNewFacility({
                          ...newFacility,
                          facilityType: v as FacilityType,
                          parentFacilityId:
                            v === "branch" || v === "division" ? "" : newFacility.parentFacilityId,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FACILITY_TYPE_VALUES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {FACILITY_TYPE_LABELS[t]} — {FACILITY_TYPE_EXAMPLES[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(newFacility.facilityType === "clinic" || newFacility.facilityType === "warehouse") && (
                    <div className="space-y-2">
                      <Label>Parent branch</Label>
                      <Select
                        value={newFacility.parentFacilityId || undefined}
                        onValueChange={(v) => setNewFacility({ ...newFacility, parentFacilityId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branchOptions.map((b) => (
                            <SelectItem key={b.id} value={String(b.id)}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="nf-address">Address</Label>
                    <Input
                      id="nf-address"
                      value={newFacility.address}
                      onChange={(e) => setNewFacility({ ...newFacility, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nf-city">City</Label>
                      <Input
                        id="nf-city"
                        value={newFacility.city}
                        onChange={(e) => setNewFacility({ ...newFacility, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nf-state">State / region</Label>
                      <Input
                        id="nf-state"
                        value={newFacility.state}
                        onChange={(e) => setNewFacility({ ...newFacility, state: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nf-contact">Primary contact</Label>
                    <Input
                      id="nf-contact"
                      value={newFacility.contactPerson}
                      onChange={(e) =>
                        setNewFacility({ ...newFacility, contactPerson: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nf-phone">Phone</Label>
                      <Input
                        id="nf-phone"
                        value={newFacility.contactPhone}
                        onChange={(e) =>
                          setNewFacility({ ...newFacility, contactPhone: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nf-email">Email</Label>
                      <Input
                        id="nf-email"
                        type="email"
                        value={newFacility.contactEmail}
                        onChange={(e) =>
                          setNewFacility({ ...newFacility, contactEmail: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateFacility} disabled={createSiteMutation.isPending}>
                    {createSiteMutation.isPending ? "Creating…" : "Create facility"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Template
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <div className="flex-1 space-y-2 md:max-w-sm">
          <Label htmlFor="facility-search">Search by name</Label>
          <Input
            id="facility-search"
            placeholder="Search facilities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full space-y-2 md:w-56">
          <Label>State / region</Label>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {stateOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="flex h-auto w-full flex-wrap gap-1">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="branch">Branches</TabsTrigger>
          <TabsTrigger value="division">Divisions</TabsTrigger>
          <TabsTrigger value="clinic">Clinics</TabsTrigger>
          <TabsTrigger value="warehouse">Warehouses</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="sites-list">
        {filteredFacilities.map((site) => (
                  <Card key={site.id} data-testid={`site-card-${site.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <div className="min-w-0">
                            {editingSiteId === site.id ? (
                              <Input
                                value={String(editData.name ?? "")}
                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                className="h-8 text-lg font-semibold"
                              />
                            ) : (
                              <CardTitle className="line-clamp-2 text-lg">{site.name}</CardTitle>
                            )}
                            {editingSiteId === site.id ? (
                              <div className="mt-2 space-y-2">
                                <Select
                                  value={String(editData.facilityType ?? "branch")}
                                  onValueChange={(v) =>
                                    setEditData({
                                      ...editData,
                                      facilityType: v,
                                      parentFacilityId:
                                        v === "branch" || v === "division" ? "" : editData.parentFacilityId,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FACILITY_TYPE_VALUES.map((t) => (
                                      <SelectItem key={t} value={t}>
                                        {FACILITY_TYPE_LABELS[t]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {(editData.facilityType === "clinic" ||
                                  editData.facilityType === "warehouse") && (
                                  <Select
                                    value={String(editData.parentFacilityId || "")}
                                    onValueChange={(v) =>
                                      setEditData({ ...editData, parentFacilityId: v })
                                    }
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue placeholder="Parent branch" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {facilities
                                        ?.filter((f) => f.facilityType === "branch" && f.id !== site.id)
                                        .map((b) => (
                                          <SelectItem key={b.id} value={String(b.id)}>
                                            {b.name}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            ) : (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={cn("border", TYPE_BADGE[site.facilityType])}
                                >
                                  {FACILITY_TYPE_LABELS[site.facilityType]}
                                </Badge>
                                {site.parentFacilityName && (
                                  <span className="text-xs text-muted-foreground">
                                    Under{" "}
                                    <span className="font-medium text-foreground">{site.parentFacilityName}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <Badge variant={site.isActive ? "default" : "secondary"}>
                            {site.isActive ? "Active" : "Inactive"}
                          </Badge>
                          {canManageFacilities &&
                            (editingSiteId === site.id ? (
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
                            ))}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {editingSiteId === site.id ? (
                        <div className="space-y-2">
                          <Input
                            placeholder="Address"
                            value={String(editData.address ?? "")}
                            onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                            className="text-sm"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="City"
                              value={String(editData.city ?? "")}
                              onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                              className="text-sm"
                            />
                            <Input
                              placeholder="State"
                              value={String(editData.state ?? "")}
                              onChange={(e) => setEditData({ ...editData, state: e.target.value })}
                              className="text-sm"
                            />
                          </div>
                          <Input
                            placeholder="Primary contact"
                            value={String(editData.contactPerson ?? "")}
                            onChange={(e) => setEditData({ ...editData, contactPerson: e.target.value })}
                            className="text-sm"
                          />
                          <Input
                            placeholder="Phone"
                            value={String(editData.contactPhone ?? "")}
                            onChange={(e) => setEditData({ ...editData, contactPhone: e.target.value })}
                            className="text-sm"
                          />
                          <Input
                            placeholder="Email"
                            type="email"
                            value={String(editData.contactEmail ?? "")}
                            onChange={(e) => setEditData({ ...editData, contactEmail: e.target.value })}
                            className="text-sm"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1 text-sm">
                            {site.address && (
                              <p className="text-muted-foreground">{site.address}</p>
                            )}
                            {(site.city || site.state) && (
                              <p className="text-muted-foreground">
                                {[site.city, site.state].filter(Boolean).join(", ")}
                              </p>
                            )}
                            {site.contactPerson && (
                              <p className="text-muted-foreground">
                                <span className="font-medium">Primary contact:</span> {site.contactPerson}
                              </p>
                            )}
                            {site.contactPhone && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{site.contactPhone}</span>
                              </div>
                            )}
                            {site.contactEmail && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span>{site.contactEmail}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 border-t pt-3 text-sm">
                            <Link
                              href={`${appPath("/assets")}?siteId=${site.id}`}
                              title="Open asset register filtered to this facility"
                              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                            >
                              <Package className="h-3.5 w-3.5" />
                              {site.assetCount} assets
                            </Link>
                            <Link
                              href={`${appPath("/inventory")}?siteId=${site.id}`}
                              title="Open inventory for this facility"
                              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                            >
                              <Boxes className="h-3.5 w-3.5" />
                              {site.inventoryCount} inventory
                            </Link>
                            <Link
                              href={appPath("/users")}
                              title="Open user directory (staff linked to this facility)"
                              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                            >
                              <Users className="h-3.5 w-3.5" />
                              {site.staffCount} staff
                            </Link>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
        ))}
      </div>
    </div>
  );
}
