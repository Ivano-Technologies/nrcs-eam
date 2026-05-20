import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { useLocation } from "wouter";
import type { FacilitiesSegment } from "@/lib/facilityRoutes";
import { parseFacilityTypeFromSearch, segmentToListFilter } from "@/lib/facilityRoutes";
import { trpc } from "@/lib/trpc";
import PageLoader from "@/components/ui/PageLoader";
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
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM_COUNTRY } from "@/lib/mapDefaults";
import { Download, Edit2, MapPin, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { ViewToggle } from "@/components/ViewToggle";
import { CardQrCode } from "@/components/CardQrCode";
import { ModuleFiltersCard, ModuleFilterSearch } from "@/components/ModuleFiltersCard";
import { useBulkImportFileInput } from "@/hooks/useBulkImportFileInput";

type ViewMode = "table" | "card" | "map";
type SortKey = "code" | "name" | "facilityType" | "parentFacilityName" | "state" | "isActive";
type SortDir = "asc" | "desc";
type PageSize = "25" | "50" | "100" | "all";

const TYPE_BADGE: Record<FacilityType, string> = {
  branch: "bg-blue-600/15 text-blue-800 border-blue-200 dark:text-blue-200",
  division: "bg-violet-600/15 text-violet-800 border-violet-200 dark:text-violet-200",
  clinic: "bg-emerald-600/15 text-emerald-800 border-emerald-200 dark:text-emerald-200",
  warehouse: "bg-amber-600/15 text-amber-900 border-amber-200 dark:text-amber-200",
  national_headquarters: "bg-rose-600/15 text-rose-900 border-rose-200 dark:text-rose-200",
};

type FacilityForm = {
  code: string;
  name: string;
  facilityType: FacilityType;
  parentFacilityId: string;
  address: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
  postalCode: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  isActive: boolean;
};

const validParentTypes: Record<FacilityType, FacilityType[]> = {
  national_headquarters: [],
  branch: ["national_headquarters"],
  division: ["branch"],
  warehouse: ["branch"],
  clinic: ["branch"],
};

const emptyForm = (): FacilityForm => ({
  code: "",
  name: "",
  facilityType: "branch",
  parentFacilityId: "",
  address: "",
  city: "",
  state: "",
  latitude: "",
  longitude: "",
  postalCode: "",
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
  isActive: true,
});

export type FacilitiesPageProps = {
  segment: FacilitiesSegment;
  /** Open create dialog on mount (e.g. `/facilities/new`) and apply `?type=`. */
  autoOpenCreate?: boolean;
};

export function FacilitiesPage({ segment, autoOpenCreate }: FacilitiesPageProps) {
  const [location, setLocation] = useLocation();
  const { canEditFacilities } = usePermissions();
  const lockedFacilityType = segmentToListFilter(segment);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "table";
    return window.localStorage.getItem("viewMode_facilities") === "card" ? "card" : "table";
  });
  const [typeFilter, setTypeFilter] = useState<string>("all"); // only used when segment === "all"
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

  const { data: allSites, isLoading, refetch } = trpc.sites.list.useQuery(undefined, {
    staleTime: 120_000,
  });

  const effectiveTypeFilter = lockedFacilityType ?? (typeFilter === "all" ? "all" : typeFilter);

  const facilities = useMemo(() => {
    const rows = allSites ?? [];
    if (effectiveTypeFilter === "all") return rows;
    return rows.filter((s) => s.facilityType === effectiveTypeFilter);
  }, [allSites, effectiveTypeFilter]);
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
  });
  const facilitiesImportFile = useBulkImportFileInput({
    accept: ".xlsx,.xls",
    isPending: importMutation.isPending,
    prepareFile: "base64",
    onError: (message) => toast.error(`Import failed: ${message}`),
    run: async (fileData): Promise<void> => {
      await importMutation.mutateAsync({ fileData });
    },
  });
  const exportQuery = trpc.bulkOperations.exportSites.useQuery(undefined, { enabled: false });
  const templateQuery = trpc.bulkOperations.downloadSiteTemplate.useQuery(undefined, { enabled: false });

  const stateOptions = useMemo(() => {
    const values = new Set<string>();
    for (const f of facilities ?? []) if (f.state?.trim()) values.add(f.state.trim());
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [facilities]);

  const parentOptions = allSites ?? [];

  useEffect(() => {
    if (!autoOpenCreate) return;
    const parsed = parseFacilityTypeFromSearch(
      typeof window !== "undefined" ? window.location.search : ""
    );
    setCreateForm({
      ...emptyForm(),
      ...(parsed ? { facilityType: parsed } : {}),
    });
    setIsCreateOpen(true);
  }, [autoOpenCreate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const st = new URLSearchParams(window.location.search).get("status");
    if (st === "active" || st === "inactive" || st === "all") {
      setStatusFilter(st);
    }
  }, [location]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (facilities ?? []).filter((f) => {
      if (effectiveTypeFilter !== "all" && f.facilityType !== effectiveTypeFilter) return false;
      if (statusFilter === "active" && !f.isActive) return false;
      if (statusFilter === "inactive" && f.isActive) return false;
      if (stateFilter !== "all" && (f.state ?? "") !== stateFilter) return false;
      if (!q) return true;
      const hay = `${f.code ?? ""} ${f.name} ${f.address ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [facilities, search, stateFilter, statusFilter, effectiveTypeFilter]);

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
    const bounds = new google.maps.LatLngBounds();
    (facilities ?? []).forEach((f) => {
      if (!f.latitude || !f.longitude) return;
      const position = { lat: parseFloat(f.latitude), lng: parseFloat(f.longitude) };
      const marker = new google.maps.Marker({
        map,
        position,
        title: f.name,
      });
      marker.addListener("click", () => setLocation(appPath(`/facilities/${f.id}`)));
      next.push(marker);
      bounds.extend(position);
    });
    setMarkers(next);
    if (next.length > 0) {
      map.fitBounds(bounds);
      if (next.length === 1) {
        map.setZoom(12);
      }
    } else {
      map.setCenter(DEFAULT_MAP_CENTER);
      map.setZoom(DEFAULT_MAP_ZOOM_COUNTRY);
    }
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
      form.facilityType === "national_headquarters"
        ? null
        : form.parentFacilityId
          ? Number(form.parentFacilityId)
          : null,
    address: form.address || undefined,
    city: form.city || undefined,
    state: form.state || undefined,
    latitude: form.latitude || undefined,
    longitude: form.longitude || undefined,
    postalCode: form.postalCode || undefined,
    contactPerson: form.contactPerson || undefined,
    contactPhone: form.contactPhone || undefined,
    contactEmail: form.contactEmail || undefined,
    isActive: form.isActive,
  });

  const validateCoordinates = (form: FacilityForm): string | null => {
    const latRaw = form.latitude.trim();
    const lonRaw = form.longitude.trim();
    if (latRaw) {
      const lat = Number(latRaw);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return "Latitude must be a number between -90 and 90.";
      }
    }
    if (lonRaw) {
      const lon = Number(lonRaw);
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        return "Longitude must be a number between -180 and 180.";
      }
    }
    return null;
  };

  const validateHierarchyBeforeSubmit = (form: FacilityForm): string | null => {
    const allowedParents = validParentTypes[form.facilityType] ?? [];
    if (allowedParents.length === 0) return null;
    if (!form.parentFacilityId) {
      return `A parent facility is required for ${FACILITY_TYPE_LABELS[form.facilityType]}`;
    }
    const parent = (allSites ?? []).find((x) => x.id === Number(form.parentFacilityId));
    if (!parent) {
      return "Invalid parent: selected parent facility does not exist";
    }
    if (!allowedParents.includes(parent.facilityType)) {
      const expected = allowedParents.map((type) => FACILITY_TYPE_LABELS[type]).join(" or ");
      return `Invalid parent: ${FACILITY_TYPE_LABELS[form.facilityType]} must have a ${expected} as parent`;
    }
    return null;
  };

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

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <ModuleFiltersCard
        filterRow={
          <>
            <ModuleFilterSearch
              placeholder="Search name, code, address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {lockedFacilityType == null ? (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {FACILITY_TYPE_VALUES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {FACILITY_TYPE_LABELS[t]}s
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {stateOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        toolbarStart={
          <>
            <ViewToggle value={viewMode === "card" ? "card" : "table"} onChange={setViewMode} />
            <Button
              variant={viewMode === "map" ? "secondary" : "outline"}
              className="h-9"
              onClick={() => setViewMode("map")}
            >
              <MapPin className="mr-2 h-4 w-4" />
              Map
            </Button>
          </>
        }
        toolbarEnd={
          <>
            <Button
              className="h-9"
              variant="outline"
              onClick={async () => {
                const res = await exportQuery.refetch();
                if (res.data) downloadBase64(res.data.data, res.data.filename);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
            <Button
              className="h-9"
              variant="outline"
              onClick={async () => {
                const res = await templateQuery.refetch();
                if (res.data) downloadBase64(res.data.data, res.data.filename);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Template
            </Button>
            <label className="inline-flex cursor-pointer">
              <Button className="h-9" asChild variant="outline">
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </span>
              </Button>
              <input {...facilitiesImportFile.inputProps} />
            </label>
            {canEditFacilities ? (
              <Button className="h-9" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Facility
              </Button>
            ) : null}
          </>
        }
      />

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
                  const hierarchyError = validateHierarchyBeforeSubmit(createForm);
                  if (hierarchyError) return toast.error(hierarchyError);
                  const coordinateError = validateCoordinates(createForm);
                  if (coordinateError) return toast.error(coordinateError);
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
        <div
          className="frozen-table-wrap rounded-md border bg-card px-2 md:px-3"
          style={
            {
              "--col1-width": "56px",
              "--col2-width": "260px",
            } as Record<string, string>
          }
          data-testid="sites-list"
        >
          <Table
            className="min-w-[1600px] text-sm"
          >
            <TableHeader className="bg-background">
              <TableRow>
                <StickyHead className="px-2 py-1.5 text-left font-medium whitespace-nowrap">S/No</StickyHead>
                <StickyHead onClick={() => sort("name")} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Name</StickyHead>
                <StickyHead onClick={() => sort("state")} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">State/Region</StickyHead>
                <TableHead className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Address</TableHead>
                <TableHead onClick={() => sort("code")} className="cursor-pointer px-2 py-1.5 text-left font-medium whitespace-nowrap">Code</TableHead>
                <TableHead onClick={() => sort("facilityType")} className="cursor-pointer px-2 py-1.5 text-left font-medium whitespace-nowrap">Type</TableHead>
                <TableHead onClick={() => sort("parentFacilityName")} className="cursor-pointer px-2 py-1.5 text-left font-medium whitespace-nowrap">Parent Facility</TableHead>
                <TableHead className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Contact</TableHead>
                <TableHead className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Phone</TableHead>
                <TableHead className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Postal Code</TableHead>
                <TableHead onClick={() => sort("isActive")} className="cursor-pointer px-2 py-1.5 text-left font-medium whitespace-nowrap">Status</TableHead>
                <TableHead className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((f, idx) => {
                const rowNo = (page - 1) * pageSizeNum + idx + 1;
                const rowCls = idx % 2 ? "bg-muted/30" : "bg-background";
                return (
                  <TableRow
                    key={f.id}
                    data-testid={`facility-row-${f.id}`}
                    className={cn("relative z-10 h-9 cursor-pointer hover:bg-muted/50", rowCls)}
                    onClick={() => setLocation(appPath(`/facilities/${f.id}`))}
                  >
                    <StickyCell className="px-2 py-1 text-muted-foreground">{rowNo}</StickyCell>
                    <StickyCell className="px-2 py-1 w-[260px] min-w-[260px] max-w-[260px] truncate font-medium" data-testid={`facility-name-${f.id}`}>{f.name}</StickyCell>
                    <StickyCell className="px-2 py-1 w-[160px] min-w-[160px] max-w-[160px] truncate">{f.state ?? "—"}</StickyCell>
                    <TableCell title={f.address ?? ""} className="px-2 py-1 max-w-[260px] truncate">
                      {f.address ?? "—"}
                    </TableCell>
                    <TableCell className="px-2 py-1">{f.code ?? "—"}</TableCell>
                    <TableCell className="px-2 py-1">
                      <Badge variant="outline" className={cn("border", TYPE_BADGE[f.facilityType])}>
                        {FACILITY_TYPE_LABELS[f.facilityType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 py-1">{f.parentFacilityName ?? "—"}</TableCell>
                    <TableCell className="px-2 py-1">{f.contactPerson ?? "—"}</TableCell>
                    <TableCell className="px-2 py-1">{f.contactPhone ?? "—"}</TableCell>
                    <TableCell className="px-2 py-1">{f.postalCode ?? "—"}</TableCell>
                    <TableCell className="px-2 py-1">
                      <Badge variant={f.isActive ? "default" : "secondary"}>
                        {f.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      {canEditFacilities && (
                        <div className="flex items-center gap-1">
                          {editingId === f.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const hierarchyError = validateHierarchyBeforeSubmit(editForm);
                                  if (hierarchyError) return toast.error(hierarchyError);
                                  const coordinateError = validateCoordinates(editForm);
                                  if (coordinateError) return toast.error(coordinateError);
                                  updateMutation.mutate({ id: f.id, ...toPayload(editForm) });
                                }}
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
                                    latitude: f.latitude ?? "",
                                    longitude: f.longitude ?? "",
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
  const requiredParentTypes = validParentTypes[form.facilityType] ?? [];
  const canChooseParent = requiredParentTypes.length > 0;
  const filteredParents = parentOptions.filter((p) =>
    requiredParentTypes.includes(p.facilityType as FacilityType)
  );

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ABI-BRN-001" /></div>
      <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div>
        <Label>Facility Type *</Label>
        <Select value={form.facilityType} onValueChange={(v) => setForm({ ...form, facilityType: v as FacilityType, parentFacilityId: v === "national_headquarters" ? "" : form.parentFacilityId })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FACILITY_TYPE_VALUES.map((t) => (
              <SelectItem key={t} value={t}>{FACILITY_TYPE_LABELS[t]} — {FACILITY_TYPE_EXAMPLES[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={canChooseParent ? "" : "hidden"}>
        <Label>Parent Facility *</Label>
        <Select
          disabled={!canChooseParent}
          value={form.parentFacilityId || undefined}
          onValueChange={(v) => setForm({ ...form, parentFacilityId: v })}
        >
          <SelectTrigger><SelectValue placeholder="Select parent facility" /></SelectTrigger>
          <SelectContent>
            {filteredParents.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
      <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
      <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
      <div>
        <Label>Latitude</Label>
        <Input
          value={form.latitude}
          onChange={(e) => setForm({ ...form, latitude: e.target.value })}
          placeholder="-90 to 90 (optional)"
        />
      </div>
      <div>
        <Label>Longitude</Label>
        <Input
          value={form.longitude}
          onChange={(e) => setForm({ ...form, longitude: e.target.value })}
          placeholder="-180 to 180 (optional)"
        />
      </div>
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

function StickyHead(props: ComponentProps<typeof TableHead>) {
  const { className, ...rest } = props;
  return (
    <TableHead
      className={cn("border-r bg-background cursor-pointer", className)}
      {...rest}
    />
  );
}

function StickyCell(props: ComponentProps<typeof TableCell>) {
  const { className, ...rest } = props;
  return (
    <TableCell
      className={cn("border-r", className)}
      {...rest}
    />
  );
}
