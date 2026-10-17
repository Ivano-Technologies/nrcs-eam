import { useAuth } from "@/_core/hooks/useAuth";
import { TableEmptyState } from "@/components/ui/EmptyState";
import { DateHint, formatDate } from "@/lib/format";
import { InsuranceRegisterContent } from "@/pages/compliance/InsuranceRegister";
import PageHeader from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KPI_VALUE_CLASS } from "@/lib/kpiTypography";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { STATUS_TONE_BADGE_CLASS, STATUS_TONE_TEXT_CLASS } from "@/lib/statusTone";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

type VehicleRow = inferRouterOutputs<AppRouter>["complianceTracking"]["vehicles"]["list"][number];
type GeneratorRow = inferRouterOutputs<AppRouter>["complianceTracking"]["generators"]["list"][number];
type BuildingRow = inferRouterOutputs<AppRouter>["complianceTracking"]["buildings"]["list"][number];
type DonorRow = inferRouterOutputs<AppRouter>["complianceTracking"]["donor"]["list"][number];
import { Building2, FileText, Loader2, Plus, ShieldCheck, Truck, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { ConfirmDeleteRecordDialog } from "@/components/compliance/ConfirmDeleteRecordDialog";
import { NoDateBadge } from "@/components/compliance/NoDateBadge";
import { parseComplianceRegisterQuery as parseQuery } from "@/lib/complianceRegisterQuery";

const TAB_TRIGGER_CLASS = "flex-none shrink-0";
/** IVA-180: text columns and multi-word headers wrap so the table fits its card at 1280; dates, codes,
 *  money and badges stay on one line. */
const WRAP_HEAD = "whitespace-normal";
const WRAP_CELL = "min-w-[7rem] whitespace-normal";

const ASSET_CODE_NOT_FOUND = "No asset has this code. Check the code and try again.";

function AssetCodeError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="-mt-1 text-sm text-danger dark:text-primary-on-dark">
      {message}
    </p>
  );
}

/** Asset code with its description underneath (one column instead of two, IVA-180). */
function AssetCell({ code, description }: { code: string | null; description: string | null }) {
  return (
    <div className="min-w-0">
      <div className="font-medium whitespace-nowrap">{code}</div>
      {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
    </div>
  );
}

type TabKey = "vehicles" | "generators" | "buildings" | "donor" | "insurance";

function docBadge(status: string) {
  if (status === "compliant") return <Badge className={STATUS_TONE_BADGE_CLASS.success}>Compliant</Badge>;
  if (status === "expiring") return <Badge className={STATUS_TONE_BADGE_CLASS.warning}>Expiring soon</Badge>;
  if (status === "non_compliant") return <Badge className={STATUS_TONE_BADGE_CLASS.danger}>Non-compliant</Badge>;
  if (status === "no_date") return <NoDateBadge />;
  return <Badge variant="secondary">{status}</Badge>;
}

const VEHICLE_FILTER_LABELS = {
  expiring: "expiring soon",
  non_compliant: "non-compliant",
  no_date: "no date",
} as const;

function generatorBadge(status: string) {
  if (status === "serviced") return <Badge className={STATUS_TONE_BADGE_CLASS.success}>Serviced</Badge>;
  if (status === "no_date") return <NoDateBadge />;
  if (status === "due_soon") return <Badge className={STATUS_TONE_BADGE_CLASS.warning}>Due soon</Badge>;
  return <Badge className={STATUS_TONE_BADGE_CLASS.danger}>Overdue</Badge>;
}

function donorBadge(status: string) {
  if (status === "submitted") return <Badge className={STATUS_TONE_BADGE_CLASS.success}>Submitted</Badge>;
  if (status === "due_soon") return <Badge className={STATUS_TONE_BADGE_CLASS.warning}>Due soon</Badge>;
  if (status === "overdue") return <Badge className={STATUS_TONE_BADGE_CLASS.danger}>Overdue</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

export default function ComplianceRegister() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "manager";
  // IVA-160: non-admins can only add papers for vehicles at their own facility, so hide Add without one.
  const canAddVehicle = canEdit && (user?.role === "admin" || user?.siteId != null);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { tab: initialTab, status: urlStatus } = useMemo(() => parseQuery(search), [search]);
  const [tab, setTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const utils = trpc.useUtils();
  // IVA-173: every register delete goes through one confirm dialog.
  const [pendingDelete, setPendingDelete] = useState<
    { kind: "vehicle" | "generator" | "building" | "donor"; id: number; title: string } | null
  >(null);
  const { data: summary } = trpc.complianceTracking.summary.useQuery();

  const vehicleStatus =
    urlStatus === "expiring"
      ? "expiring"
      : urlStatus === "non-compliant"
        ? "non_compliant"
        : urlStatus === "no-date"
          ? "no_date"
          : undefined;
  const generatorStatus =
    urlStatus === "overdue" ? "overdue" : urlStatus === "due-soon" ? "due_soon" : undefined;
  const donorStatus =
    urlStatus === "due-soon" ? "due_soon" : urlStatus === "overdue" ? "overdue" : undefined;

  const { data: vehicles } = trpc.complianceTracking.vehicles.list.useQuery(
    vehicleStatus ? { status: vehicleStatus } : undefined,
    { enabled: tab === "vehicles" }
  );
  const { data: generators } = trpc.complianceTracking.generators.list.useQuery(
    generatorStatus ? { status: generatorStatus } : undefined,
    { enabled: tab === "generators" }
  );
  const { data: buildings } = trpc.complianceTracking.buildings.list.useQuery(undefined, {
    enabled: tab === "buildings",
  });
  const { data: donorRows } = trpc.complianceTracking.donor.list.useQuery(
    donorStatus ? { status: donorStatus } : undefined,
    { enabled: tab === "donor" }
  );
  const { data: sites } = trpc.sites.list.useQuery(undefined, { enabled: canEdit });

  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    id: undefined as number | undefined,
    assetCode: "",
    assetId: 0,
    plateNumber: "",
    roadWorthinessExpiry: "",
    insuranceExpiry: "",
    licenceExpiry: "",
    lastInspectionDate: "",
    notes: "",
  });

  const vehicleUpsert = trpc.complianceTracking.vehicles.upsert.useMutation({
    onSuccess: () => {
      toast.success("Vehicle record saved");
      void utils.complianceTracking.vehicles.list.invalidate();
      void utils.complianceTracking.summary.invalidate();
      setVehicleOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const vehicleDelete = trpc.complianceTracking.vehicles.delete.useMutation({
    onSuccess: () => {
      toast.success("Record deleted");
      setPendingDelete(null);
      void utils.complianceTracking.vehicles.list.invalidate();
      void utils.complianceTracking.summary.invalidate();
    },
    // Errors show inside the confirm dialog (IVA-173); no toast while it is open.
  });

  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState({
    id: undefined as number | undefined,
    assetCode: "",
    assetId: 0,
    lastServiceDate: "",
    nextServiceDue: "",
    serviceProvider: "",
    runningHoursAtService: "",
    safetyCertExpiry: "",
    notes: "",
  });
  const genUpsert = trpc.complianceTracking.generators.upsert.useMutation({
    onSuccess: () => {
      toast.success("Generator record saved");
      void utils.complianceTracking.generators.list.invalidate();
      void utils.complianceTracking.summary.invalidate();
      setGenOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const genDelete = trpc.complianceTracking.generators.delete.useMutation({
    onSuccess: () => {
      toast.success("Record deleted");
      setPendingDelete(null);
      void utils.complianceTracking.generators.list.invalidate();
      void utils.complianceTracking.summary.invalidate();
    },
    // Errors show inside the confirm dialog (IVA-173); no toast while it is open.
  });

  const [buildingOpen, setBuildingOpen] = useState(false);
  const [buildingForm, setBuildingForm] = useState({
    id: undefined as number | undefined,
    siteId: "",
    certificateType: "Fire Safety",
    issuingAuthority: "",
    certificateNumber: "",
    issueDate: "",
    expiryDate: "",
    notes: "",
  });
  const buildingUpsert = trpc.complianceTracking.buildings.upsert.useMutation({
    onSuccess: () => {
      toast.success("Building safety record saved");
      void utils.complianceTracking.buildings.list.invalidate();
      void utils.complianceTracking.summary.invalidate();
      setBuildingOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const buildingDelete = trpc.complianceTracking.buildings.delete.useMutation({
    onSuccess: () => {
      toast.success("Record deleted");
      setPendingDelete(null);
      void utils.complianceTracking.buildings.list.invalidate();
      void utils.complianceTracking.summary.invalidate();
    },
    // Errors show inside the confirm dialog (IVA-173); no toast while it is open.
  });

  const [donorOpen, setDonorOpen] = useState(false);
  const [donorForm, setDonorForm] = useState({
    id: undefined as number | undefined,
    donorName: "",
    programmeRef: "",
    reportType: "Quarterly",
    dueDate: "",
    submittedDate: "",
    notes: "",
  });
  const donorUpsert = trpc.complianceTracking.donor.upsert.useMutation({
    onSuccess: () => {
      toast.success("Donor reporting record saved");
      void utils.complianceTracking.donor.list.invalidate();
      void utils.complianceTracking.summary.invalidate();
      setDonorOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const donorDelete = trpc.complianceTracking.donor.delete.useMutation({
    onSuccess: () => {
      toast.success("Record deleted");
      setPendingDelete(null);
      void utils.complianceTracking.donor.list.invalidate();
      void utils.complianceTracking.summary.invalidate();
    },
    // Errors show inside the confirm dialog (IVA-173); no toast while it is open.
  });

  // IVA-180: an unknown asset code is shown inline and blocks Save, instead of
  // silently saving against the previously selected asset.
  const [vehicleCodeError, setVehicleCodeError] = useState<string | null>(null);
  const [genCodeError, setGenCodeError] = useState<string | null>(null);
  useEffect(() => {
    if (vehicleOpen) setVehicleCodeError(null);
  }, [vehicleOpen]);
  useEffect(() => {
    if (genOpen) setGenCodeError(null);
  }, [genOpen]);

  async function resolveAssetCode(code: string): Promise<number | null> {
    const trimmed = code.trim();
    if (!trimmed) return null;
    const asset = await utils.complianceTracking.lookupAsset.fetch({ assetCode: trimmed });
    return asset?.id ?? null;
  }

  const onTabChange = (value: string) => {
    const t = value as TabKey;
    setTab(t);
    setLocation(`/app/administration/compliance-register?tab=${t}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Compliance register"
        subtitle="Vehicle, generator, building safety, donor reporting and insurance compliance"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Total compliance records</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={KPI_VALUE_CLASS}>{summary?.totalRecords ?? 0}</p>
            {(summary?.noDateCount ?? 0) > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground" data-testid="kpi-no-date">
                {summary?.noDateCount} with no expiry date
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Compliant</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={KPI_VALUE_CLASS}>
              {summary?.compliantCount ?? 0}{" "}
              <span className="text-sm font-normal text-muted-foreground">({summary?.compliantPct ?? 0}%)</span>
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Expiring soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(KPI_VALUE_CLASS, (summary?.expiringSoonCount ?? 0) > 0 && STATUS_TONE_TEXT_CLASS.warning)}>
              {summary?.expiringSoonCount ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Not compliant or overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(KPI_VALUE_CLASS, (summary?.nonCompliantCount ?? 0) > 0 && STATUS_TONE_TEXT_CLASS.danger)}>
              {summary?.nonCompliantCount ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        {/* IVA-180: one row that scrolls sideways at narrow widths instead of wrapping into overlapping labels. */}
        <TabsList className="flex max-w-full justify-start gap-1 overflow-x-auto" data-testid="compliance-tabs">
          <TabsTrigger value="vehicles" className={TAB_TRIGGER_CLASS}>Vehicles</TabsTrigger>
          <TabsTrigger value="generators" className={TAB_TRIGGER_CLASS}>Generators</TabsTrigger>
          <TabsTrigger value="buildings" className={TAB_TRIGGER_CLASS}>Building safety</TabsTrigger>
          <TabsTrigger value="donor" className={TAB_TRIGGER_CLASS}>Donor reporting</TabsTrigger>
          <TabsTrigger value="insurance" className={TAB_TRIGGER_CLASS}>Insurance register</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="space-y-4">
          {vehicleStatus ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid="vehicle-status-filter">
              Showing {VEHICLE_FILTER_LABELS[vehicleStatus]} only.
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onTabChange("vehicles")}>
                Show all
              </Button>
            </p>
          ) : null}
          {canAddVehicle ? (
            <Button
              onClick={() => {
                setVehicleForm({
                  id: undefined,
                  assetCode: "",
                  assetId: 0,
                  plateNumber: "",
                  roadWorthinessExpiry: "",
                  insuranceExpiry: "",
                  licenceExpiry: "",
                  lastInspectionDate: "",
                  notes: "",
                });
                setVehicleOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add vehicle record
            </Button>
          ) : null}
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Plate</TableHead>
                    <TableHead className={WRAP_HEAD}>Road worthiness</TableHead>
                    <TableHead>Insurance</TableHead>
                    <TableHead>Licence</TableHead>
                    <TableHead className={WRAP_HEAD}>Last inspection</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(vehicles ?? []).map((r: VehicleRow) => (
                    <TableRow key={r.id}>
                      <TableCell className={WRAP_CELL}>
                        <AssetCell code={r.assetCode} description={r.description} />
                      </TableCell>
                      <TableCell className={WRAP_CELL}>{r.branch}</TableCell>
                      <TableCell>{r.plateNumber}</TableCell>
                      <TableCell>{formatDate(r.roadWorthinessExpiry)}</TableCell>
                      <TableCell>{formatDate(r.insuranceExpiry)}</TableCell>
                      <TableCell>{formatDate(r.licenceExpiry)}</TableCell>
                      <TableCell>{formatDate(r.lastInspectionDate)}</TableCell>
                      <TableCell>{docBadge(r.status)}</TableCell>
                      {canEdit ? (
                        <TableCell className="space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setVehicleForm({
                                id: r.id,
                                assetCode: r.assetCode ?? "",
                                assetId: r.assetId,
                                plateNumber: r.plateNumber ?? "",
                                roadWorthinessExpiry: r.roadWorthinessExpiry ?? "",
                                insuranceExpiry: r.insuranceExpiry ?? "",
                                licenceExpiry: r.licenceExpiry ?? "",
                                lastInspectionDate: r.lastInspectionDate ?? "",
                                notes: r.notes ?? "",
                              });
                              setVehicleOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={vehicleDelete.isPending}
                            onClick={() => setPendingDelete({ kind: "vehicle", id: r.id, title: `Delete ${r.plateNumber || r.assetCode || "vehicle"} papers?` })}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                  {(vehicles ?? []).length === 0 ? (
                    <TableEmptyState
                      colSpan={8 + (canEdit ? 1 : 0)}
                      icon={Truck}
                      title="No vehicle records yet"
                    />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generators" className="space-y-4">
          {canEdit ? (
            <Button onClick={() => setGenOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add generator record
            </Button>
          ) : null}
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className={WRAP_HEAD}>Last service</TableHead>
                    <TableHead className={WRAP_HEAD}>Next due</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead className={WRAP_HEAD}>Safety cert</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(generators ?? []).map((r: GeneratorRow) => (
                    <TableRow key={r.id}>
                      <TableCell className={WRAP_CELL}>
                        <AssetCell code={r.assetCode} description={r.description} />
                      </TableCell>
                      <TableCell className={WRAP_CELL}>{r.branch}</TableCell>
                      <TableCell>{formatDate(r.lastServiceDate)}</TableCell>
                      <TableCell>{r.nextServiceDue ?? ""}</TableCell>
                      <TableCell className={WRAP_CELL}>{r.serviceProvider ?? ""}</TableCell>
                      <TableCell>{r.runningHoursAtService ?? ""}</TableCell>
                      <TableCell>{formatDate(r.safetyCertExpiry)}</TableCell>
                      <TableCell>{generatorBadge(r.status)}</TableCell>
                      {canEdit ? (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={genDelete.isPending}
                            onClick={() => setPendingDelete({ kind: "generator", id: r.id, title: `Delete ${r.assetCode || "generator"} generator record?` })}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                  {(generators ?? []).length === 0 ? (
                    <TableEmptyState
                      colSpan={8 + (canEdit ? 1 : 0)}
                      icon={Zap}
                      title="No generator records yet"
                    />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="buildings" className="space-y-4">
          {canEdit ? (
            <Button onClick={() => setBuildingOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add certificate
            </Button>
          ) : null}
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facility</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Authority</TableHead>
                    <TableHead className={WRAP_HEAD}>Certificate #</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(buildings ?? []).map((r: BuildingRow) => (
                    <TableRow key={r.id}>
                      <TableCell className={WRAP_CELL}>{r.facilityName}</TableCell>
                      <TableCell>{r.state}</TableCell>
                      <TableCell className={WRAP_CELL}>{r.certificateType}</TableCell>
                      <TableCell className={WRAP_CELL}>{r.issuingAuthority}</TableCell>
                      <TableCell>{r.certificateNumber}</TableCell>
                      <TableCell>{formatDate(r.issueDate)}</TableCell>
                      <TableCell>{formatDate(r.expiryDate)}</TableCell>
                      <TableCell>{docBadge(r.status)}</TableCell>
                      {canEdit ? (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={buildingDelete.isPending}
                            onClick={() => setPendingDelete({ kind: "building", id: r.id, title: `Delete ${r.facilityName} ${r.certificateType} certificate?` })}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                  {(buildings ?? []).length === 0 ? (
                    <TableEmptyState
                      colSpan={8 + (canEdit ? 1 : 0)}
                      icon={Building2}
                      title="No safety certificates yet"
                    />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="donor" className="space-y-4">
          {canEdit ? (
            <Button onClick={() => setDonorOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add donor report
            </Button>
          ) : null}
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Donor</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead className={WRAP_HEAD}>Asset / facility</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(donorRows ?? []).map((r: DonorRow) => (
                    <TableRow key={r.id}>
                      <TableCell className={WRAP_CELL}>{r.donorName}</TableCell>
                      <TableCell>{r.programmeRef}</TableCell>
                      <TableCell className={WRAP_CELL}>{r.assetOrFacility}</TableCell>
                      <TableCell>{r.reportType}</TableCell>
                      <TableCell>{formatDate(r.dueDate)}</TableCell>
                      <TableCell>{formatDate(r.submittedDate)}</TableCell>
                      <TableCell>{donorBadge(r.status)}</TableCell>
                      {canEdit ? (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={donorDelete.isPending}
                            onClick={() => setPendingDelete({ kind: "donor", id: r.id, title: `Delete ${r.donorName} ${r.reportType} report?` })}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                  {(donorRows ?? []).length === 0 ? (
                    <TableEmptyState
                      colSpan={7 + (canEdit ? 1 : 0)}
                      icon={FileText}
                      title="No donor reports yet"
                    />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance">
          <InsuranceRegisterContent embedded />
        </TabsContent>
      </Tabs>

      <Dialog open={vehicleOpen} onOpenChange={setVehicleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{vehicleForm.id ? "Edit" : "Add"} vehicle compliance</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Label>Asset code</Label>
            <Input
              value={vehicleForm.assetCode}
              aria-invalid={vehicleCodeError ? true : undefined}
              aria-describedby={vehicleCodeError ? "vehicle-asset-code-error" : undefined}
              data-testid="vehicle-asset-code"
              onChange={(e) => {
                setVehicleCodeError(null);
                // A changed code must be looked up again before it can be saved.
                setVehicleForm((f) => ({ ...f, assetCode: e.target.value, assetId: 0 }));
              }}
              onBlur={async () => {
                if (!vehicleForm.assetCode.trim() || vehicleForm.assetId) return;
                const id = await resolveAssetCode(vehicleForm.assetCode);
                if (id) setVehicleForm((f) => ({ ...f, assetId: id }));
                else setVehicleCodeError(ASSET_CODE_NOT_FOUND);
              }}
            />
            <AssetCodeError id="vehicle-asset-code-error" message={vehicleCodeError} />
            <Label>Plate number</Label>
            <Input
              value={vehicleForm.plateNumber}
              onChange={(e) => setVehicleForm((f) => ({ ...f, plateNumber: e.target.value }))}
            />
            <Label>Road worthiness expiry</Label>
            <Input
              type="date"
              value={vehicleForm.roadWorthinessExpiry}
              onChange={(e) => setVehicleForm((f) => ({ ...f, roadWorthinessExpiry: e.target.value }))}
            />
            <Label>Insurance expiry</Label>
            <Input
              type="date"
              value={vehicleForm.insuranceExpiry}
              onChange={(e) => setVehicleForm((f) => ({ ...f, insuranceExpiry: e.target.value }))}
            />
            <Label>Licence expiry</Label>
            <Input
              type="date"
              value={vehicleForm.licenceExpiry}
              onChange={(e) => setVehicleForm((f) => ({ ...f, licenceExpiry: e.target.value }))}
            />
            <Label>Last inspection</Label>
            <Input
              type="date"
              value={vehicleForm.lastInspectionDate}
              onChange={(e) => setVehicleForm((f) => ({ ...f, lastInspectionDate: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={vehicleUpsert.isPending}
              onClick={async () => {
                let assetId = vehicleForm.assetId;
                if (!assetId) {
                  const resolved = await resolveAssetCode(vehicleForm.assetCode);
                  if (!resolved) {
                    setVehicleCodeError(ASSET_CODE_NOT_FOUND);
                    return;
                  }
                  assetId = resolved;
                }
                vehicleUpsert.mutate({
                  id: vehicleForm.id,
                  assetId,
                  plateNumber: vehicleForm.plateNumber || undefined,
                  roadWorthinessExpiry: vehicleForm.roadWorthinessExpiry || undefined,
                  insuranceExpiry: vehicleForm.insuranceExpiry || undefined,
                  licenceExpiry: vehicleForm.licenceExpiry || undefined,
                  lastInspectionDate: vehicleForm.lastInspectionDate || undefined,
                  notes: vehicleForm.notes || undefined,
                });
              }}
            >
              {vehicleUpsert.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generator compliance</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Label>Asset code</Label>
            <Input
              value={genForm.assetCode}
              aria-invalid={genCodeError ? true : undefined}
              aria-describedby={genCodeError ? "generator-asset-code-error" : undefined}
              data-testid="generator-asset-code"
              onChange={(e) => {
                setGenCodeError(null);
                setGenForm((f) => ({ ...f, assetCode: e.target.value }));
              }}
            />
            <AssetCodeError id="generator-asset-code-error" message={genCodeError} />
            <Label>Next service due</Label>
            <Input
              type="date"
              value={genForm.nextServiceDue}
              onChange={(e) => setGenForm((f) => ({ ...f, nextServiceDue: e.target.value }))}
            />
            <Label>Service provider</Label>
            <Input
              value={genForm.serviceProvider}
              onChange={(e) => setGenForm((f) => ({ ...f, serviceProvider: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={genUpsert.isPending}
              onClick={async () => {
                const assetId = await resolveAssetCode(genForm.assetCode);
                if (!assetId) {
                  setGenCodeError(ASSET_CODE_NOT_FOUND);
                  return;
                }
                genUpsert.mutate({
                  id: genForm.id,
                  assetId,
                  nextServiceDue: genForm.nextServiceDue || undefined,
                  serviceProvider: genForm.serviceProvider || undefined,
                });
              }}
            >
              {genUpsert.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={buildingOpen} onOpenChange={setBuildingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Building safety certificate</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Label>Facility</Label>
            <Select value={buildingForm.siteId} onValueChange={(v) => setBuildingForm((f) => ({ ...f, siteId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select facility" />
              </SelectTrigger>
              <SelectContent>
                {(sites ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label>Certificate type</Label>
            <Select
              value={buildingForm.certificateType}
              onValueChange={(v) => setBuildingForm((f) => ({ ...f, certificateType: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Fire Safety", "Structural", "Occupancy", "Environmental"].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label>Expiry date <DateHint /></Label>
            <Input
              type="date"
              value={buildingForm.expiryDate}
              onChange={(e) => setBuildingForm((f) => ({ ...f, expiryDate: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={buildingUpsert.isPending}
              onClick={() => {
                const siteId = parseInt(buildingForm.siteId, 10);
                if (!siteId) {
                  toast.error("Select a facility");
                  return;
                }
                buildingUpsert.mutate({
                  id: buildingForm.id,
                  siteId,
                  certificateType: buildingForm.certificateType,
                  issuingAuthority: buildingForm.issuingAuthority || undefined,
                  certificateNumber: buildingForm.certificateNumber || undefined,
                  issueDate: buildingForm.issueDate || undefined,
                  expiryDate: buildingForm.expiryDate || undefined,
                });
              }}
            >
              {buildingUpsert.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={donorOpen} onOpenChange={setDonorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Donor reporting</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Label>Donor</Label>
            <Input
              value={donorForm.donorName}
              onChange={(e) => setDonorForm((f) => ({ ...f, donorName: e.target.value }))}
            />
            <Label>Programme reference</Label>
            <Input
              value={donorForm.programmeRef}
              onChange={(e) => setDonorForm((f) => ({ ...f, programmeRef: e.target.value }))}
            />
            <Label>Report type</Label>
            <Select
              value={donorForm.reportType}
              onValueChange={(v) => setDonorForm((f) => ({ ...f, reportType: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Quarterly", "Annual", "Ad Hoc"].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label>Due date <DateHint /></Label>
            <Input
              type="date"
              value={donorForm.dueDate}
              onChange={(e) => setDonorForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
            <Label>Submitted date <DateHint /></Label>
            <Input
              type="date"
              value={donorForm.submittedDate}
              onChange={(e) => setDonorForm((f) => ({ ...f, submittedDate: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={donorUpsert.isPending}
              onClick={() => {
                if (!donorForm.donorName || !donorForm.dueDate) {
                  toast.error("Donor and due date are required");
                  return;
                }
                donorUpsert.mutate({
                  id: donorForm.id,
                  donorName: donorForm.donorName,
                  programmeRef: donorForm.programmeRef || undefined,
                  reportType: donorForm.reportType,
                  dueDate: donorForm.dueDate,
                  submittedDate: donorForm.submittedDate || undefined,
                });
              }}
            >
              {donorUpsert.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteRecordDialog
        open={pendingDelete !== null}
        title={pendingDelete?.title ?? ""}
        pending={vehicleDelete.isPending || genDelete.isPending || buildingDelete.isPending || donorDelete.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return Promise.resolve();
          const { kind, id } = pendingDelete;
          if (kind === "vehicle") return vehicleDelete.mutateAsync({ id });
          if (kind === "generator") return genDelete.mutateAsync({ id });
          if (kind === "building") return buildingDelete.mutateAsync({ id });
          return donorDelete.mutateAsync({ id });
        }}
      />
    </div>
  );
}
