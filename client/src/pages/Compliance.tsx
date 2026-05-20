import { useAuth } from "@/_core/hooks/useAuth";
import { InsuranceRegisterContent } from "@/pages/compliance/InsuranceRegister";
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
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type VehicleRow = inferRouterOutputs<AppRouter>["complianceTracking"]["vehicles"]["list"][number];
type GeneratorRow = inferRouterOutputs<AppRouter>["complianceTracking"]["generators"]["list"][number];
type BuildingRow = inferRouterOutputs<AppRouter>["complianceTracking"]["buildings"]["list"][number];
type DonorRow = inferRouterOutputs<AppRouter>["complianceTracking"]["donor"]["list"][number];
import { Loader2, Plus, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type TabKey = "vehicles" | "generators" | "buildings" | "donor" | "insurance";

function docBadge(status: string) {
  if (status === "compliant") return <Badge className="bg-green-100 text-green-800">Compliant</Badge>;
  if (status === "expiring") return <Badge className="bg-amber-100 text-amber-800">Expiring Soon</Badge>;
  if (status === "non_compliant") return <Badge className="bg-red-100 text-red-800">Non-Compliant</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function generatorBadge(status: string) {
  if (status === "serviced") return <Badge className="bg-green-100 text-green-800">Serviced</Badge>;
  if (status === "due_soon") return <Badge className="bg-amber-100 text-amber-800">Due Soon</Badge>;
  return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
}

function donorBadge(status: string) {
  if (status === "submitted") return <Badge className="bg-green-100 text-green-800">Submitted</Badge>;
  if (status === "due_soon") return <Badge className="bg-amber-100 text-amber-800">Due Soon</Badge>;
  if (status === "overdue") return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

function parseQuery(location: string) {
  const q = location.includes("?") ? new URLSearchParams(location.split("?")[1]) : new URLSearchParams();
  const tab = q.get("tab") as TabKey | null;
  const status = q.get("status");
  return { tab: tab ?? "vehicles", status };
}

export default function Compliance() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "manager";
  const [location, setLocation] = useLocation();
  const { tab: initialTab, status: urlStatus } = useMemo(() => parseQuery(location), [location]);
  const [tab, setTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const utils = trpc.useUtils();
  const { data: summary } = trpc.complianceTracking.summary.useQuery();

  const vehicleStatus =
    urlStatus === "expiring"
      ? "expiring"
      : urlStatus === "non-compliant"
        ? "non_compliant"
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
      void utils.complianceTracking.vehicles.list.invalidate();
      void utils.complianceTracking.summary.invalidate();
    },
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
      void utils.complianceTracking.generators.list.invalidate();
      void utils.complianceTracking.summary.invalidate();
    },
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
      void utils.complianceTracking.buildings.list.invalidate();
      void utils.complianceTracking.summary.invalidate();
    },
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
      void utils.complianceTracking.donor.list.invalidate();
      void utils.complianceTracking.summary.invalidate();
    },
  });

  async function resolveAssetCode(code: string): Promise<number | null> {
    const trimmed = code.trim();
    if (!trimmed) return null;
    const asset = await utils.complianceTracking.lookupAsset.fetch({ assetCode: trimmed });
    return asset?.id ?? null;
  }

  const onTabChange = (value: string) => {
    const t = value as TabKey;
    setTab(t);
    setLocation(`/app/compliance?tab=${t}`);
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Compliance Tracking
          </h1>
          <p className="text-muted-foreground">
            Vehicle, generator, building safety, donor reporting, and insurance compliance
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total compliance records</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={KPI_VALUE_CLASS}>{summary?.totalRecords ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Compliant</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={KPI_VALUE_CLASS}>
              {summary?.compliantCount ?? 0}{" "}
              <span className="text-sm font-normal text-muted-foreground">({summary?.compliantPct ?? 0}%)</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Expiring soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(KPI_VALUE_CLASS, (summary?.expiringSoonCount ?? 0) > 0 && "text-amber-600")}>
              {summary?.expiringSoonCount ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Non-compliant / overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(KPI_VALUE_CLASS, (summary?.nonCompliantCount ?? 0) > 0 && "text-red-600")}>
              {summary?.nonCompliantCount ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="generators">Generators</TabsTrigger>
          <TabsTrigger value="buildings">Building safety</TabsTrigger>
          <TabsTrigger value="donor">Donor reporting</TabsTrigger>
          <TabsTrigger value="insurance">Insurance register</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="space-y-4">
          {canEdit ? (
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
                    <TableHead>Asset code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Plate</TableHead>
                    <TableHead>Road worthiness</TableHead>
                    <TableHead>Insurance</TableHead>
                    <TableHead>Licence</TableHead>
                    <TableHead>Last inspection</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(vehicles ?? []).map((r: VehicleRow) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.assetCode}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell>{r.branch}</TableCell>
                      <TableCell>{r.plateNumber}</TableCell>
                      <TableCell>{r.roadWorthinessExpiry ?? "—"}</TableCell>
                      <TableCell>{r.insuranceExpiry ?? "—"}</TableCell>
                      <TableCell>{r.licenceExpiry ?? "—"}</TableCell>
                      <TableCell>{r.lastInspectionDate ?? "—"}</TableCell>
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
                            onClick={() => vehicleDelete.mutate({ id: r.id })}
                          >
                            {vehicleDelete.isPending && vehicleDelete.variables?.id === r.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting…
                              </>
                            ) : (
                              "Delete"
                            )}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
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
                    <TableHead>Asset code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Last service</TableHead>
                    <TableHead>Next due</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Safety cert</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(generators ?? []).map((r: GeneratorRow) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.assetCode}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell>{r.branch}</TableCell>
                      <TableCell>{r.lastServiceDate ?? "—"}</TableCell>
                      <TableCell>{r.nextServiceDue ?? "—"}</TableCell>
                      <TableCell>{r.serviceProvider ?? "—"}</TableCell>
                      <TableCell>{r.runningHoursAtService ?? "—"}</TableCell>
                      <TableCell>{r.safetyCertExpiry ?? "—"}</TableCell>
                      <TableCell>{generatorBadge(r.status)}</TableCell>
                      {canEdit ? (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={genDelete.isPending}
                            onClick={() => genDelete.mutate({ id: r.id })}
                          >
                            {genDelete.isPending && genDelete.variables?.id === r.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting…
                              </>
                            ) : (
                              "Delete"
                            )}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
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
                    <TableHead>Certificate #</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(buildings ?? []).map((r: BuildingRow) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.facilityName}</TableCell>
                      <TableCell>{r.state}</TableCell>
                      <TableCell>{r.certificateType}</TableCell>
                      <TableCell>{r.issuingAuthority}</TableCell>
                      <TableCell>{r.certificateNumber}</TableCell>
                      <TableCell>{r.issueDate ?? "—"}</TableCell>
                      <TableCell>{r.expiryDate ?? "—"}</TableCell>
                      <TableCell>{docBadge(r.status)}</TableCell>
                      {canEdit ? (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={buildingDelete.isPending}
                            onClick={() => buildingDelete.mutate({ id: r.id })}
                          >
                            {buildingDelete.isPending && buildingDelete.variables?.id === r.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting…
                              </>
                            ) : (
                              "Delete"
                            )}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
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
                    <TableHead>Asset / facility</TableHead>
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
                      <TableCell>{r.donorName}</TableCell>
                      <TableCell>{r.programmeRef}</TableCell>
                      <TableCell>{r.assetOrFacility}</TableCell>
                      <TableCell>{r.reportType}</TableCell>
                      <TableCell>{r.dueDate}</TableCell>
                      <TableCell>{r.submittedDate ?? "—"}</TableCell>
                      <TableCell>{donorBadge(r.status)}</TableCell>
                      {canEdit ? (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={donorDelete.isPending}
                            onClick={() => donorDelete.mutate({ id: r.id })}
                          >
                            {donorDelete.isPending && donorDelete.variables?.id === r.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting…
                              </>
                            ) : (
                              "Delete"
                            )}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
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
              onChange={(e) => setVehicleForm((f) => ({ ...f, assetCode: e.target.value }))}
              onBlur={async () => {
                const id = await resolveAssetCode(vehicleForm.assetCode);
                if (id) setVehicleForm((f) => ({ ...f, assetId: id }));
              }}
            />
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
                    toast.error("Asset code not found");
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
              onChange={(e) => setGenForm((f) => ({ ...f, assetCode: e.target.value }))}
            />
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
                  toast.error("Asset code not found");
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
            <Label>Expiry date</Label>
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
            <Label>Due date</Label>
            <Input
              type="date"
              value={donorForm.dueDate}
              onChange={(e) => setDonorForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
            <Label>Submitted date</Label>
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
    </div>
  );
}
