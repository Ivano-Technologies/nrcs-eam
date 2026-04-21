import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { toast } from "sonner";
import { appPath } from "@/lib/routes";
import {
  FACILITY_TYPE_EXAMPLES,
  FACILITY_TYPE_LABELS,
  FACILITY_TYPE_VALUES,
  type FacilityType,
} from "@shared/facilities";
import { cn } from "@/lib/utils";
import { MapView } from "@/components/Map";
import { Download, Edit2, MapPin, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { ViewToggle } from "@/components/ViewToggle";
import { CardQrCode } from "@/components/CardQrCode";

type ViewMode = "table" | "card" | "map";
type SortKey = "code" | "name" | "facilityType" | "parentFacilityName" | "state" | "isActive";
type SortDir = "asc" | "desc";
type PageSize = "25" | "50" | "100" | "all";

const TYPE_BADGE: Record<FacilityType, string> = {
  branch: "bg-blue-600/15 text-blue-800 border-blue-200 dark:text-blue-200",
  division: "bg-violet-600/15 text-violet-800 border-violet-200 dark:text-violet-200",
  clinic: "bg-emerald-600/15 text-emerald-800 border-emerald-200 dark:text-emerald-200",
  warehouse: "bg-amber-600/15 text-amber-900 border-amber-200 dark:text-amber-200",
};

type FacilityForm = {
  code: string;
  name: string;
  facilityType: FacilityType;
  parentFacilityId: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  isActive: boolean;
};

const emptyForm = (): FacilityForm => ({
  code: "",
  name: "",
  facilityType: "branch",
  parentFacilityId: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
  isActive: true,
});

export default function Facilities() {
  const [, setLocation] = useLocation();
  const { canEditFacilities } = usePermissions();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "table";
    return window.localStorage.getItem("viewMode_facilities") === "card" ? "card" : "table";
  });
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>("50");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<FacilityForm>(emptyForm());
  const [editForm, setEditForm] = useState<FacilityForm>(emptyForm());
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);

  const { data: facilities, isLoading, refetch } = trpc.sites.list.useQuery();
  const createMutation = trpc.sites.create.useMutation({
    onSuccess: async () => {
      toast.success("Facility created successfully");
      setIsCreateOpen(false);
      setCreateForm(emptyForm());
      await refetch();
    },
    onError: (e) => toast.error(`Failed to create facility: ${e.message}`),
  });
  const updateMutation = trpc.sites.update.useMutation({
    onSuccess: async () => {
      toast.success("Facility updated successfully");
      setEditingId(null);
      await refetch();
    },
    onError: (e) => toast.error(`Failed to update facility: ${e.message}`),
  });
  const deleteMutation = trpc.sites.bulkDelete.useMutation({
    onSuccess: async ({ deleted }) => {
      toast.success(`Deleted ${deleted} facility${deleted === 1 ? "" : "ies"}`);
      await refetch();
    },
    onError: (e) => toast.error(`Delete failed: ${e.message}`),
  });
  const importMutation = trpc.bulkOperations.importSites.useMutation({
    onSuccess: async (result) => {
      if (result.success) toast.success(`Imported ${result.imported} facilities`);
      else toast.warning(`Imported ${result.imported} facilities, ${result.failed} failed`);
      await refetch();
    },
    onError: (e) => toast.error(`Import failed: ${e.message}`),
  });
  const exportQuery = trpc.bulkOperations.exportSites.useQuery(undefined, { enabled: false });
  const templateQuery = trpc.bulkOperations.downloadSiteTemplate.useQuery(undefined, { enabled: false });

  const stateOptions = useMemo(() => {
    const values = new Set<string>();
    for (const f of facilities ?? []) if (f.state?.trim()) values.add(f.state.trim());
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [facilities]);

  const parentOptions = useMemo(
    () => (facilities ?? []).filter((f) => f.facilityType === "branch"),
    [facilities]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (facilities ?? []).filter((f) => {
      if (typeFilter !== "all" && f.facilityType !== typeFilter) return false;
      if (statusFilter === "active" && !f.isActive) return false;
      if (statusFilter === "inactive" && f.isActive) return false;
      if (stateFilter !== "all" && (f.state ?? "") !== stateFilter) return false;
      if (!q) return true;
      const hay = `${f.code ?? ""} ${f.name} ${f.address ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [facilities, search, stateFilter, statusFilter, typeFilter]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const av =
        sortKey === "isActive"
          ? Number(a.isActive)
          : String((a as Record<string, unknown>)[sortKey] ?? "").toLowerCase();
      const bv =
        sortKey === "isActive"
          ? Number(b.isActive)
          : String((b as Record<string, unknown>)[sortKey] ?? "").toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [filtered, sortDir, sortKey]);

  const pageSizeNum = pageSize === "all" ? sorted.length || 1 : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSizeNum));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSizeNum;
    return sorted.slice(start, start + pageSizeNum);
  }, [page, pageSizeNum, sorted]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (typeof window !== "undefined" && (viewMode === "table" || viewMode === "card")) {
      window.localStorage.setItem("viewMode_facilities", viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    if (!map) return;
    markers.forEach((m) => m.setMap(null));
    const next: google.maps.Marker[] = [];
    (facilities ?? []).forEach((f) => {
      if (!f.latitude || !f.longitude) return;
      const marker = new google.maps.Marker({
        map,
        position: { lat: parseFloat(f.latitude), lng: parseFloat(f.longitude) },
        title: f.name,
      });
      marker.addListener("click", () => setLocation(appPath(`/facilities/${f.id}`)));
      next.push(marker);
    });
    setMarkers(next);
  }, [facilities, map, setLocation]);

  const sort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const toPayload = (form: FacilityForm) => ({
    code: form.code.trim() || undefined,
    name: form.name.trim(),
    facilityType: form.facilityType,
    parentFacilityId:
      form.facilityType === "branch"
        ? null
        : form.parentFacilityId
          ? Number(form.parentFacilityId)
          : null,
    address: form.address || undefined,
    city: form.city || undefined,
    state: form.state || undefined,
    postalCode: form.postalCode || undefined,
    contactPerson: form.contactPerson || undefined,
    contactPhone: form.contactPhone || undefined,
    contactEmail: form.contactEmail || undefined,
    isActive: form.isActive,
  });

  const downloadBase64 = (base64: string, filename: string) => {
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result);
      importMutation.mutate({ fileData: data.split(",")[1] ?? "" });
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) return <div className="h-96 animate-pulse rounded-md bg-muted" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Facilities Management</h1>
          <p className="mt-1 text-muted-foreground">Manage NRCS facilities</p>
        </div>
        <div className="flex gap-2">
          <ViewToggle value={viewMode === "card" ? "card" : "table"} onChange={setViewMode} />
          <Button
            variant={viewMode === "map" ? "secondary" : "outline"}
            className="h-9"
            onClick={() => setViewMode("map")}
          >
            <MapPin className="mr-2 h-4 w-4" />
            Map
          </Button>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search name, code, address"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 min-w-[240px] md:min-w-[280px]"
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {FACILITY_TYPE_VALUES.map((t) => (
                <SelectItem key={t} value={t}>{FACILITY_TYPE_LABELS[t]}s</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {stateOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="h-9"
            variant="outline"
            onClick={async () => {
              const res = await exportQuery.refetch();
              if (res.data) downloadBase64(res.data.data, res.data.filename);
            }}
          >
            <Download className="mr-2 h-4 w-4" />Export to Excel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              className="h-9"
              variant="outline"
              onClick={async () => {
                const res = await templateQuery.refetch();
                if (res.data) downloadBase64(res.data.data, res.data.filename);
              }}
            >
              Template
            </Button>
            <label className="inline-flex">
              <Button className="h-9" asChild variant="outline"><span><Upload className="mr-2 h-4 w-4" />Import</span></Button>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={(e) => handleImport(e.target.files?.[0])}
              />
            </label>
            {canEditFacilities && (
              <Button className="h-9" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />Add Facility
              </Button>
            )}
          </div>
        </div>
      </div>

      {canEditFacilities && (
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Add Facility</DialogTitle>
              <DialogDescription>Create a new facility record</DialogDescription>
            </DialogHeader>
            <FacilityFormFields
              form={createForm}
              setForm={setCreateForm}
              parentOptions={parentOptions}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!createForm.name.trim()) return toast.error("Facility name is required");
                  createMutation.mutate(toPayload(createForm));
                }}
              >
                {createMutation.isPending ? "Saving..." : "Create Facility"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {viewMode === "map" ? (
        <Card>
          <CardContent className="pt-6"><MapView onMapReady={setMap} /></CardContent>
        </Card>
      ) : viewMode === "card" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="sites-list">
          {pageRows.map((f) => (
            <Card key={f.id} onClick={() => setLocation(appPath(`/facilities/${f.id}`))} className="cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{f.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("border", TYPE_BADGE[f.facilityType])}>
                    {FACILITY_TYPE_LABELS[f.facilityType]}
                  </Badge>
                  <Badge variant={f.isActive ? "default" : "secondary"}>
                    {f.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="text-muted-foreground">{f.code ?? "—"}</div>
                <div className="text-muted-foreground">{f.address ?? "—"}</div>
                <div className="text-muted-foreground">{f.contactPerson ?? "—"}</div>
                <div className="text-muted-foreground">{f.parentFacilityName ? `Parent: ${f.parentFacilityName}` : "Parent: —"}</div>
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <CardQrCode
                    idValue={String(f.id)}
                    title={f.name}
                    subtitle={f.code ?? `Facility #${f.id}`}
                    encodedValue={`https://nrcseam.techivano.com/app/facilities/${f.id}`}
                    labelSize="50x50"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border px-2 md:px-3" data-testid="sites-list">
          <Table className="min-w-[1600px] text-xs">
            <TableHeader className="sticky top-0 z-40 bg-background">
              <TableRow>
                <StickyHead left={0}>S/No</StickyHead>
                <StickyHead left={56} onClick={() => sort("name")}>Name</StickyHead>
                <StickyHead left={316} onClick={() => sort("state")} className="shadow-[4px_0_8px_-4px_rgba(0,0,0,0.25)]">State/Region</StickyHead>
                <TableHead>Address</TableHead>
                <TableHead onClick={() => sort("code")} className="cursor-pointer">Code</TableHead>
                <TableHead onClick={() => sort("facilityType")} className="cursor-pointer">Type</TableHead>
                <TableHead onClick={() => sort("parentFacilityName")} className="cursor-pointer">Parent Facility</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Postal Code</TableHead>
                <TableHead onClick={() => sort("isActive")} className="cursor-pointer">Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((f, idx) => {
                const rowNo = (page - 1) * pageSizeNum + idx + 1;
                const rowCls = idx % 2 ? "bg-muted/20" : "";
                return (
                  <TableRow
                    key={f.id}
                    data-testid={`facility-row-${f.id}`}
                    className={cn("relative z-10 h-9 cursor-pointer", rowCls)}
                    onClick={() => setLocation(appPath(`/facilities/${f.id}`))}
                  >
                    <StickyCell left={0}>{rowNo}</StickyCell>
                    <StickyCell left={56} className="w-[260px] min-w-[260px] max-w-[260px] truncate font-medium" data-testid={`facility-name-${f.id}`}>{f.name}</StickyCell>
                    <StickyCell left={316} className="w-[160px] min-w-[160px] max-w-[160px] truncate shadow-[4px_0_8px_-4px_rgba(0,0,0,0.25)]">{f.state ?? "—"}</StickyCell>
                    <TableCell title={f.address ?? ""} className="max-w-[260px] truncate">
                      {f.address ?? "—"}
                    </TableCell>
                    <TableCell>{f.code ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("border", TYPE_BADGE[f.facilityType])}>
                        {FACILITY_TYPE_LABELS[f.facilityType]}
                      </Badge>
                    </TableCell>
                    <TableCell>{f.parentFacilityName ?? "—"}</TableCell>
                    <TableCell>{f.contactPerson ?? "—"}</TableCell>
                    <TableCell>{f.contactPhone ?? "—"}</TableCell>
                    <TableCell>{f.postalCode ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={f.isActive ? "default" : "secondary"}>
                        {f.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canEditFacilities && (
                        <div className="flex items-center gap-1">
                          {editingId === f.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateMutation.mutate({ id: f.id, ...toPayload(editForm) })}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingId(f.id);
                                  setEditForm({
                                    code: f.code ?? "",
                                    name: f.name,
                                    facilityType: f.facilityType,
                                    parentFacilityId: f.parentFacilityId ? String(f.parentFacilityId) : "",
                                    address: f.address ?? "",
                                    city: f.city ?? "",
                                    state: f.state ?? "",
                                    postalCode: f.postalCode ?? "",
                                    contactPerson: f.contactPerson ?? "",
                                    contactPhone: f.contactPhone ?? "",
                                    contactEmail: f.contactEmail ?? "",
                                    isActive: f.isActive,
                                  });
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (!window.confirm(`Delete facility "${f.name}"?`)) return;
                                  deleteMutation.mutate({ ids: [f.id] });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editingId && (
        <Card>
          <CardHeader><CardTitle>Edit Facility</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FacilityFormFields form={editForm} setForm={setEditForm} parentOptions={parentOptions} />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{sorted.length} facilities</div>
        <div className="flex items-center gap-2">
          <Select value={pageSize} onValueChange={(v) => setPageSize(v as PageSize)}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
              <SelectItem value="100">100 rows</SelectItem>
              <SelectItem value="all">All rows</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm">Page {page} of {totalPages}</span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

function FacilityFormFields(props: {
  form: FacilityForm;
  setForm: (x: FacilityForm) => void;
  parentOptions: Array<{ id: number; name: string; facilityType: string }>;
}) {
  const { form, setForm, parentOptions } = props;
  const canChooseParent = form.facilityType !== "branch";
  const showBranchParents = form.facilityType === "clinic" || form.facilityType === "warehouse";
  const filteredParents = showBranchParents
    ? parentOptions.filter((p) => p.facilityType === "branch")
    : parentOptions;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ABI-BRN-001" /></div>
      <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div>
        <Label>Facility Type *</Label>
        <Select value={form.facilityType} onValueChange={(v) => setForm({ ...form, facilityType: v as FacilityType, parentFacilityId: v === "branch" ? "" : form.parentFacilityId })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FACILITY_TYPE_VALUES.map((t) => (
              <SelectItem key={t} value={t}>{FACILITY_TYPE_LABELS[t]} — {FACILITY_TYPE_EXAMPLES[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Parent Facility</Label>
        <Select
          disabled={!canChooseParent}
          value={form.parentFacilityId || "none"}
          onValueChange={(v) => setForm({ ...form, parentFacilityId: v === "none" ? "" : v })}
        >
          <SelectTrigger><SelectValue placeholder="Optional parent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {filteredParents.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
      <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
      <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
      <div><Label>Postal Code</Label><Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
      <div><Label>Contact</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
      <div><Label>Phone</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
      <div><Label>Email</Label><Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
      <div>
        <Label>Status</Label>
        <Select value={form.isActive ? "active" : "inactive"} onValueChange={(v) => setForm({ ...form, isActive: v === "active" })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function StickyHead(props: ComponentProps<typeof TableHead> & { left: number }) {
  const { left, className, ...rest } = props;
  return (
    <TableHead
      className={cn("sticky z-[45] border-r bg-background cursor-pointer", className)}
      style={{ left }}
      {...rest}
    />
  );
}

function StickyCell(props: ComponentProps<typeof TableCell> & { left: number }) {
  const { left, className, ...rest } = props;
  return (
    <TableCell
      className={cn("sticky z-[35] border-r bg-background", className)}
      style={{ left }}
      {...rest}
    />
  );
}
