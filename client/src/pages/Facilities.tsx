import { useEffect, useLayoutEffect, useMemo, useState, type ComponentProps } from "react";
import { useFullBleed } from "@/lib/fullBleed";
import { formatEmpty } from "@/lib/format";
import { Link, useLocation, useSearch } from "wouter";
import type { FacilitiesSegment } from "@/lib/facilityRoutes";
import {
  FACILITIES_VIEW_NAME,
  FACILITIES_VIEWS,
  isFacilitiesMapSearch,
  parseFacilityTypeFromSearch,
  segmentToListFilter,
  withFacilitiesView,
} from "@/lib/facilityRoutes";
import { readSavedViewMode, saveViewMode, useDropLegacyViewMode } from "@/hooks/useViewMode";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
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
import { CircleCheck, CircleOff, Edit2, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { CardQrCode } from "@/components/CardQrCode";
import { BULK_BAR_BUTTON_CLASS, BulkActionsToolbar } from "@/components/BulkActionsToolbar";
import { Checkbox } from "@/components/ui/checkbox";
import { downloadCsv, toCsv } from "@/lib/csv";
import { FacilitiesToolbar } from "@/components/facilities/FacilitiesToolbar";
import { FacilitiesMap } from "@/components/facilities/FacilitiesMap";
import {
  facilityCounts,
  filterFacilityRows,
  siteHasLocation,
  type FacilityStatusFilter,
} from "@/lib/facilitiesList";
import { useBulkImportFileInput } from "@/hooks/useBulkImportFileInput";
import { useIsMobile } from "@/hooks/useMobile";

type FacilitiesViewMode = "table" | "card" | "map";
type SortKey = "code" | "name" | "facilityType" | "parentFacilityName" | "state" | "isActive";
type SortDir = "asc" | "desc";
type PageSize = "25" | "50" | "100" | "all";

/** Badge text: short form so the badge fits beside the pinned columns at 390 (matches the "National HQ" tab). */
const TYPE_BADGE_LABEL: Record<FacilityType, string> = {
  ...FACILITY_TYPE_LABELS,
  national_headquarters: "National HQ",
};

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
  /** Legacy: `/facilities/new` now redirects to `?new=1` on the current segment. */
  autoOpenCreate?: boolean;
};

export function FacilitiesPage({ segment, autoOpenCreate }: FacilitiesPageProps) {
  const [location, setLocation] = useLocation();
  const { canEditFacilities } = usePermissions();
  const lockedFacilityType = segmentToListFilter(segment);
  const isMobile = useIsMobile();
  // View: Map lives in the URL (?view=map) so the layout folds the sidebar from the route; Table
  // and Card come from the saved choice (Card by default). The choice, Map included, is saved only
  // on a toggle; a saved Map reopens as ?view=map on desktop and tablet.
  const urlSearch = useSearch();
  const urlMap = isFacilitiesMapSearch(urlSearch);
  const [savedView, setSavedView] = useState<FacilitiesViewMode | null>(() =>
    readSavedViewMode<FacilitiesViewMode>(FACILITIES_VIEW_NAME, FACILITIES_VIEWS)
  );
  const [listOverride, setListOverride] = useState<"table" | "card" | null>(null);
  useDropLegacyViewMode(FACILITIES_VIEW_NAME);
  const listView: "table" | "card" = listOverride ?? (isMobile ? "card" : savedView === "table" ? "table" : "card");
  const urlHasView = new URLSearchParams(urlSearch).has("view");
  const restoreMap = !urlHasView && !isMobile && listOverride == null && savedView === "map";
  const viewMode: FacilitiesViewMode = urlMap || restoreMap ? "map" : listView;
  useLayoutEffect(() => {
    if (restoreMap) setLocation(withFacilitiesView(location, urlSearch, "map"), { replace: true });
  }, [restoreMap, location, urlSearch, setLocation]);
  // The layout already folds from the URL (routeWantsFullBleed); this keeps the view opt in explicit.
  useFullBleed(viewMode === "map");
  const setViewMode = (mode: FacilitiesViewMode) => {
    setSavedView(mode);
    saveViewMode(FACILITIES_VIEW_NAME, mode);
    // Replace, not push: switching views never adds a Back step.
    if (mode === "map") {
      setListOverride(null);
      setLocation(withFacilitiesView(location, urlSearch, "map"), { replace: true });
      return;
    }
    setListOverride(mode);
    if (urlMap) setLocation(withFacilitiesView(location, urlSearch, null), { replace: true });
  };
  const [statusFilter, setStatusFilter] = useState<FacilityStatusFilter>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>("50");
  // One dialog for Add and Edit. Add opens in place from `?new=1` (and `&type=`), so the page
  // keeps its view and the sidebar fold; closing clears the param.
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FacilityForm>(emptyForm());
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const searchParams = new URLSearchParams(urlSearch);
  const wantsNew = searchParams.get("new") === "1";

  const { data: allSites, isLoading, refetch } = trpc.sites.list.useQuery(undefined, {
    staleTime: 120_000,
  });

  // The facility type comes from the route (/facilities/<segment>), set by the sidebar.
  const effectiveTypeFilter: FacilityType | "all" = lockedFacilityType ?? "all";

  const facilities = useMemo(() => {
    const rows = allSites ?? [];
    if (effectiveTypeFilter === "all") return rows;
    return rows.filter((s) => s.facilityType === effectiveTypeFilter);
  }, [allSites, effectiveTypeFilter]);
  const createMutation = trpc.sites.create.useMutation({
    onSuccess: async () => {
      toast.success("Facility created");
      closeDialog();
      await refetch();
    },
    onError: (e) => toast.error(`Failed to create facility: ${e.message}`),
  });
  const trpcUtils = trpc.useUtils();
  const updateMutation = trpc.sites.update.useMutation({
    onSuccess: async () => {
      toast.success("Facility updated");
      void trpcUtils.sites.getById.invalidate();
      closeDialog();
      await refetch();
    },
    onError: (e) => toast.error(`Failed to update facility: ${e.message}`),
  });
  const deleteMutation = trpc.sites.bulkDelete.useMutation({
    onSuccess: async ({ deleted }) => {
      if (deleted === 0) toast.error("Facility not deleted. It may still have assets or child facilities.");
      else toast.success(deleted === 1 ? "Facility deleted" : `Deleted ${deleted} facilities`);
      await refetch();
    },
    onError: (e) => toast.error(`Could not delete the facility: ${e.message}`),
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
    if (!(wantsNew || autoOpenCreate) || !canEditFacilities) return;
    const parsed = parseFacilityTypeFromSearch(urlSearch);
    setForm({ ...emptyForm(), ...(parsed ? { facilityType: parsed } : {}) });
    setEditingId(null);
    setDialogMode("create");
  }, [wantsNew, autoOpenCreate, canEditFacilities, urlSearch]);

  // `?edit=<id>` (the Edit action on a facility's detail page) opens the same dialog for that row;
  // closing or saving returns to the detail page.
  const editParam = searchParams.get("edit");
  useEffect(() => {
    if (!editParam || !canEditFacilities || !allSites) return;
    const row = allSites.find((s) => String(s.id) === editParam);
    if (row) openEdit(row);
  }, [editParam, canEditFacilities, allSites]);

  function closeDialog() {
    setDialogMode(null);
    setEditingId(null);
    if (editParam) {
      setLocation(appPath(`/facilities/${editParam}`), { replace: true });
      return;
    }
    if (wantsNew) {
      const params = new URLSearchParams(urlSearch);
      params.delete("new");
      params.delete("type");
      const qs = params.toString();
      setLocation(location + (qs ? `?${qs}` : ""), { replace: true });
    }
  }

  function openEdit(f: NonNullable<typeof allSites>[number]) {
    setEditingId(f.id);
    setForm({
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
    setDialogMode("edit");
  }

  function submitDialog() {
    if (!form.name.trim()) return toast.error("Facility name is required");
    const hierarchyError = validateHierarchyBeforeSubmit(form);
    if (hierarchyError) return toast.error(hierarchyError);
    const coordinateError = validateCoordinates(form);
    if (coordinateError) return toast.error(coordinateError);
    if (dialogMode === "edit" && editingId != null) {
      updateMutation.mutate({ id: editingId, ...toPayload(form) });
    } else {
      createMutation.mutate(toPayload(form));
    }
  }

  const qrOrigin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const st = new URLSearchParams(window.location.search).get("status");
    if (st === "active" || st === "inactive" || st === "all") {
      setStatusFilter(st);
    }
  }, [location]);

  const filtered = useMemo(
    () =>
      filterFacilityRows(facilities ?? [], {
        type: effectiveTypeFilter,
        state: stateFilter,
        status: statusFilter,
        q: search,
      }),
    [facilities, search, stateFilter, statusFilter, effectiveTypeFilter]
  );
  const counts = useMemo(() => facilityCounts(filtered), [filtered]);
  const visibleIds = useMemo(() => new Set(filtered.map((f) => f.id)), [filtered]);
  const noLocationRows = useMemo(
    () =>
      filtered
        .filter((f) => !siteHasLocation(f))
        .map((f) => ({ id: f.id, name: f.name, code: f.code, state: f.state })),
    [filtered]
  );

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

  // Bulk selection covers the visible page only and clears when the page, filters or sort change,
  // so nothing is acted on that the user cannot see.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const pageIdsKey = pageRows.map((f) => f.id).join(",");
  useEffect(() => {
    setSelectedIds(new Set());
  }, [pageIdsKey, viewMode]);
  const selectedOnPage = pageRows.filter((f) => selectedIds.has(f.id)).map((f) => f.id);
  const selectedCount = selectedOnPage.length;
  const allOnPageSelected = pageRows.length > 0 && selectedCount === pageRows.length;
  const someOnPageSelected = selectedCount > 0 && !allOnPageSelected;
  const toggleSelected = (id: number, on: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const togglePageSelected = (on: boolean) => setSelectedIds(on ? new Set(pageRows.map((f) => f.id)) : new Set());
  const clearSelection = () => setSelectedIds(new Set());
  const facilityCount = (n: number) => `${n} ${n === 1 ? "facility" : "facilities"}`;
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkActiveTarget, setBulkActiveTarget] = useState<boolean | null>(null);

  const bulkDeleteMutation = trpc.sites.bulkDelete.useMutation({
    onSuccess: async (res) => {
      if (res.deleted === res.total) toast.success(`Deleted ${facilityCount(res.deleted)}`);
      else if (res.deleted === 0) toast.error("No facilities were deleted. They may still have assets or child facilities.");
      else toast.warning(`Deleted ${res.deleted} of ${facilityCount(res.total)}. ${res.total - res.deleted} could not be deleted.`);
      setBulkDeleteOpen(false);
      clearSelection();
      await refetch();
    },
    onError: (e) => toast.error(`Could not delete the selected facilities: ${e.message}`),
  });
  const bulkActiveMutation = trpc.sites.bulkSetActive.useMutation({
    onSuccess: async (res, vars) => {
      const label = vars.isActive ? "active" : "inactive";
      if (res.updated === res.total) toast.success(`Marked ${facilityCount(res.updated)} as ${label}`);
      else if (res.updated === 0) toast.error("No facilities were updated.");
      else toast.warning(`Marked ${res.updated} of ${facilityCount(res.total)} as ${label}.`);
      setBulkActiveTarget(null);
      clearSelection();
      await refetch();
    },
    onError: (e) => toast.error(`Could not update the selected facilities: ${e.message}`),
  });
  const bulkPending = bulkDeleteMutation.isPending || bulkActiveMutation.isPending;
  const exportSelected = () => {
    const chosen = pageRows.filter((f) => selectedIds.has(f.id));
    const csv = toCsv(
      ["Name", "Type", "Code", "State", "Address", "Parent facility", "Contact", "Phone", "Postal code", "Status"],
      chosen.map((f) => [
        f.name,
        TYPE_BADGE_LABEL[f.facilityType],
        f.code,
        f.state,
        f.address,
        f.parentFacilityName,
        f.contactPerson,
        f.contactPhone,
        f.postalCode,
        f.isActive ? "Active" : "Inactive",
      ])
    );
    downloadCsv(csv, `facilities_selected_${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`Exported ${facilityCount(chosen.length)} to CSV`);
  };

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

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <FacilitiesToolbar
        search={search}
        onSearch={setSearch}
        state={stateFilter}
        states={stateOptions}
        onState={setStateFilter}
        status={statusFilter}
        onStatus={setStatusFilter}
        counts={counts}
        view={viewMode}
        onView={setViewMode}
        compact={isMobile}
        onExport={async () => {
          const res = await exportQuery.refetch();
          if (res.data) downloadBase64(res.data.data, res.data.filename);
        }}
        onTemplate={async () => {
          const res = await templateQuery.refetch();
          if (res.data) downloadBase64(res.data.data, res.data.filename);
        }}
        onImport={() => document.getElementById(facilitiesImportFile.inputId)?.click()}
        importBusy={facilitiesImportFile.isBusy}
      />
      <input {...facilitiesImportFile.inputProps} aria-label="Import facilities from Excel" data-testid="facilities-import-input" />

      {canEditFacilities && (
        <Dialog open={dialogMode !== null} onOpenChange={(open) => (open ? null : closeDialog())}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{dialogMode === "edit" ? "Edit facility" : "Add facility"}</DialogTitle>
              <DialogDescription>
                {dialogMode === "edit" ? "Update this facility record" : "Create a new facility record"}
              </DialogDescription>
            </DialogHeader>
            <FacilityFormFields form={form} setForm={setForm} parentOptions={parentOptions} />
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button disabled={saving} onClick={submitDialog} data-testid="facility-dialog-save">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : dialogMode === "edit" ? (
                  "Save changes"
                ) : (
                  "Create facility"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => (open ? null : setPendingDelete(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete facility</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {pendingDelete?.name}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="facility-delete-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate({ ids: [pendingDelete.id] });
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading && viewMode !== "map" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="sites-list-loading" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : viewMode === "map" ? (
        <FacilitiesMap visibleIds={visibleIds} noLocation={noLocationRows} />
      ) : viewMode === "card" ? (
        <div className="space-y-3">
        {pageRows.length > 0 ? (
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              data-testid="facility-select-all-cards"
              checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
              onCheckedChange={(v) => togglePageSelected(v === true)}
            />
            Select all on this page
          </label>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="sites-list">
          {pageRows.map((f) => (
            <FacilityCard
              key={f.id}
              facility={f}
              qrOrigin={qrOrigin}
              canEdit={canEditFacilities}
              selected={selectedIds.has(f.id)}
              onSelectedChange={(on) => toggleSelected(f.id, on)}
              onEdit={() => openEdit(f)}
              onDelete={() => setPendingDelete({ id: f.id, name: f.name })}
            />
          ))}
        </div>
        </div>
      ) : (
        <div
          className="frozen-table-wrap sticky-lead-cols rounded-md border bg-card px-2 md:px-3"
          style={
            {
              "--col1-width": "84px",
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
                <StickyHead className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <Checkbox
                      aria-label="Select all facilities on this page"
                      data-testid="facility-select-all"
                      disabled={pageRows.length === 0}
                      checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                      onCheckedChange={(v) => togglePageSelected(v === true)}
                    />
                    S/No
                  </span>
                </StickyHead>
                <StickyHead onClick={() => sort("name")} className="w-[9rem] min-w-[9rem] md:w-auto md:min-w-[12rem] px-2 py-1.5 text-left font-medium whitespace-nowrap">Name</StickyHead>
                <TableHead onClick={() => sort("facilityType")} className="cursor-pointer px-3 py-1.5 text-left font-medium whitespace-nowrap">Type</TableHead>
                <TableHead onClick={() => sort("code")} className="cursor-pointer px-2 py-1.5 text-left font-medium whitespace-nowrap">Code</TableHead>
                <TableHead onClick={() => sort("state")} className="cursor-pointer px-2 py-1.5 text-left font-medium whitespace-nowrap">State</TableHead>
                <TableHead className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Address</TableHead>
                <TableHead onClick={() => sort("parentFacilityName")} className="cursor-pointer px-2 py-1.5 text-left font-medium whitespace-nowrap">Parent facility</TableHead>
                <TableHead className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Contact</TableHead>
                <TableHead className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Phone</TableHead>
                <TableHead className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Postal code</TableHead>
                <TableHead onClick={() => sort("isActive")} className="cursor-pointer px-2 py-1.5 text-left font-medium whitespace-nowrap">Status</TableHead>
                <TableHead className="px-2 pr-4 py-1.5 text-left font-medium whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((f, idx) => {
                const rowNo = (page - 1) * pageSizeNum + idx + 1;
                const rowCls = selectedIds.has(f.id)
                  ? "bg-[color-mix(in_oklab,var(--primary)_7%,var(--background))]"
                  : idx % 2 ? "bg-muted/30" : "bg-background";
                return (
                  <TableRow
                    key={f.id}
                    data-testid={`facility-row-${f.id}`}
                    className={cn("relative z-10 h-9 cursor-pointer hover:bg-muted/50", rowCls)}
                    onClick={() => setLocation(appPath(`/facilities/${f.id}`))}
                  >
                    <StickyCell className="px-2 py-1 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                      <span className="flex items-center gap-2">
                        <Checkbox
                          aria-label={`Select ${f.name}`}
                          data-testid={`facility-select-${f.id}`}
                          checked={selectedIds.has(f.id)}
                          onCheckedChange={(v) => toggleSelected(f.id, v === true)}
                        />
                        {rowNo}
                      </span>
                    </StickyCell>
                    <StickyCell className="px-2 py-1 w-[9rem] min-w-[9rem] md:w-auto md:min-w-[12rem] whitespace-normal font-medium" data-testid={`facility-name-${f.id}`}>
                      <Link href={appPath(`/facilities/${f.id}`)} className="hover:underline focus-visible:underline focus-visible:outline-none" onClick={(e) => e.stopPropagation()}>
                        {f.name}
                      </Link>
                    </StickyCell>
                    {/* Type sits right after the pinned columns so the badge is always reachable in full (1280 and 390). */}
                    <TableCell className="px-3 py-1 whitespace-nowrap" data-testid={`facility-type-${f.id}`}>
                      <Badge variant="outline" className={cn("border whitespace-nowrap", TYPE_BADGE[f.facilityType])}>
                        {TYPE_BADGE_LABEL[f.facilityType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 py-1 whitespace-nowrap">{f.code ?? ""}</TableCell>
                    <TableCell className="px-2 py-1 whitespace-nowrap">{f.state ?? ""}</TableCell>
                    <TableCell title={f.address ?? ""} className="px-2 py-1 max-w-[260px] truncate">
                      {f.address ?? ""}
                    </TableCell>
                    <TableCell className="px-2 py-1 min-w-[12rem] whitespace-normal">{formatEmpty(f.parentFacilityName)}</TableCell>
                    <TableCell className="px-2 py-1">{f.contactPerson ?? ""}</TableCell>
                    <TableCell className="px-2 py-1">{f.contactPhone ?? ""}</TableCell>
                    <TableCell className="px-2 py-1">{f.postalCode ?? ""}</TableCell>
                    <TableCell className="px-2 py-1">
                      <Badge variant={f.isActive ? "default" : "secondary"}>
                        {f.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 pr-4 py-1" onClick={(e) => e.stopPropagation()}>
                      {canEditFacilities && (
                        <FacilityRowMenu
                          name={f.name}
                          onEdit={() => openEdit(f)}
                          onDelete={() => setPendingDelete({ id: f.id, name: f.name })}
                          busy={deleteMutation.isPending}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {viewMode !== "map" && !isLoading ? (
      <div className="flex items-center justify-end">
        {/* One line on phones too: rows, Previous, page count and Next never wrap. */}
        <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2" data-testid="facilities-pagination">
          <Select value={pageSize} onValueChange={(v) => setPageSize(v as PageSize)}>
            <SelectTrigger className="h-9 w-[112px] shrink-0 sm:w-[130px]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
              <SelectItem value="100">100 rows</SelectItem>
              <SelectItem value="all">All rows</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-9 shrink-0 px-2.5 sm:px-3" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="whitespace-nowrap text-sm tabular-nums">Page {page} of {totalPages}</span>
          <Button variant="outline" className="h-9 shrink-0 px-2.5 sm:px-3" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
      ) : null}

      {viewMode !== "map" ? (
        <BulkActionsToolbar
          selectedCount={selectedCount}
          itemLabel="facilities"
          onClearSelection={clearSelection}
          onExport={exportSelected}
          onDelete={canEditFacilities ? () => setBulkDeleteOpen(true) : undefined}
          disabled={bulkPending}
        >
          {canEditFacilities ? (
            <>
              <Button variant="outline" size="sm" className={BULK_BAR_BUTTON_CLASS} disabled={bulkPending} onClick={() => setBulkActiveTarget(true)} data-testid="bulk-actions-activate">
                <CircleCheck className="h-4 w-4" />
                Mark active
              </Button>
              <Button variant="outline" size="sm" className={BULK_BAR_BUTTON_CLASS} disabled={bulkPending} onClick={() => setBulkActiveTarget(false)} data-testid="bulk-actions-deactivate">
                <CircleOff className="h-4 w-4" />
                Mark inactive
              </Button>
            </>
          ) : null}
        </BulkActionsToolbar>
      ) : null}

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open && !bulkDeleteMutation.isPending) setBulkDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {facilityCount(selectedCount)}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected facilities. Facilities that still have assets or child facilities
              are skipped. Each deletion is recorded in the audit log. You cannot undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="facility-bulk-delete-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending || selectedCount === 0}
              onClick={(e) => {
                e.preventDefault();
                bulkDeleteMutation.mutate({ ids: selectedOnPage });
              }}
            >
              {bulkDeleteMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</>) : `Delete ${selectedCount}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkActiveTarget !== null} onOpenChange={(open) => { if (!open && !bulkActiveMutation.isPending) setBulkActiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {facilityCount(selectedCount)} as {bulkActiveTarget ? "active" : "inactive"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkActiveTarget
                ? "Active facilities appear in pickers, reports and the map."
                : "Inactive facilities stay on record but are hidden from pickers. Their assets and stock are not changed."}{" "}
              Each change is recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkActiveMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="facility-bulk-active-confirm"
              disabled={bulkActiveMutation.isPending || selectedCount === 0 || bulkActiveTarget === null}
              onClick={(e) => {
                e.preventDefault();
                if (bulkActiveTarget !== null) bulkActiveMutation.mutate({ ids: selectedOnPage, isActive: bulkActiveTarget });
              }}
            >
              {bulkActiveMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating…</>) : bulkActiveTarget ? "Mark active" : "Mark inactive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        <Label>Facility type *</Label>
        <Select value={form.facilityType} onValueChange={(v) => setForm({ ...form, facilityType: v as FacilityType, parentFacilityId: v === "national_headquarters" ? "" : form.parentFacilityId })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FACILITY_TYPE_VALUES.map((t) => (
              <SelectItem key={t} value={t}>{FACILITY_TYPE_LABELS[t]} ({FACILITY_TYPE_EXAMPLES[t]})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={canChooseParent ? "" : "hidden"}>
        <Label>Parent facility *</Label>
        <Select
          disabled={!canChooseParent}
          value={form.parentFacilityId || undefined}
          onValueChange={(v) => setForm({ ...form, parentFacilityId: v })}
        >
          <SelectTrigger className="w-full"><SelectValue placeholder="Select parent facility" /></SelectTrigger>
          <SelectContent>
            {filteredParents.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Plot 1 Example Street, Abuja Nigeria" /></div>
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
      <div><Label>Postal code</Label><Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
      <div><Label>Contact</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
      <div><Label>Phone</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
      <div><Label>Email</Label><Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
      <div>
        <Label>Status</Label>
        <Select value={form.isActive ? "active" : "inactive"} onValueChange={(v) => setForm({ ...form, isActive: v === "active" })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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

type FacilityRow = {
  id: number;
  name: string;
  code: string | null;
  facilityType: FacilityType;
  isActive: boolean;
  address: string | null;
  state: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  parentFacilityName?: string | null;
};

/** List card (IVA-146 A2 to A5): labelled rows, empty fields skipped, title link, small QR icon. */
function FacilityCard({
  facility: f,
  qrOrigin,
  canEdit,
  selected,
  onSelectedChange,
  onEdit,
  onDelete,
}: {
  facility: FacilityRow;
  qrOrigin: string;
  canEdit: boolean;
  selected: boolean;
  onSelectedChange: (on: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const rows: Array<[string, string | null | undefined]> = [
    ["Code", f.code],
    ["Address", f.address],
    ["State", f.state],
    ["Contact", f.contactPerson],
    ["Phone", f.contactPhone],
    ["Parent", f.parentFacilityName],
  ];
  return (
    <Card
      size="sm"
      data-testid={`facility-card-${f.id}`}
      className={cn(
        "relative h-full px-4 transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring",
        selected && "border-primary bg-primary/5 ring-1 ring-primary focus-within:ring-primary"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="relative z-10 flex h-6 shrink-0 items-center">
          <Checkbox
            aria-label={`Select ${f.name}`}
            data-testid={`facility-select-${f.id}`}
            checked={selected}
            onCheckedChange={(v) => onSelectedChange(v === true)}
          />
        </div>
        <h3 className="min-w-0 flex-1 text-base font-semibold leading-6" data-testid={`facility-name-${f.id}`}>
          <Link
            href={appPath(`/facilities/${f.id}`)}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {f.name}
          </Link>
        </h3>
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          <CardQrCode
            variant="icon"
            idValue={String(f.id)}
            title={f.name}
            subtitle={f.code ?? `Facility #${f.id}`}
            encodedValue={`${qrOrigin}/app/facilities/${f.id}`}
            labelSize="50x50"
          />
          {canEdit ? <FacilityRowMenu name={f.name} onEdit={onEdit} onDelete={onDelete} /> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("border whitespace-nowrap", TYPE_BADGE[f.facilityType])}>
          {TYPE_BADGE_LABEL[f.facilityType]}
        </Badge>
        <Badge variant={f.isActive ? "default" : "secondary"}>{f.isActive ? "Active" : "Inactive"}</Badge>
      </div>
      <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        {rows
          .filter(([, value]) => value != null && String(value).trim() !== "")
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className={cn("min-w-0", label === "Address" ? "line-clamp-2" : "truncate")}>{value}</dd>
            </div>
          ))}
      </dl>
    </Card>
  );
}

function FacilityRowMenu({
  name,
  onEdit,
  onDelete,
  busy = false,
}: {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${name}`} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Edit2 className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
