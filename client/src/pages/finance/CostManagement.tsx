import { ManagerFinanceGate } from "@/components/finance/ManagerFinanceGate";
import PageHeader from "@/components/ui/PageHeader";
import { CostAnalyticsOverview } from "@/components/finance/CostAnalyticsOverview";
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
import { Progress } from "@/components/ui/progress";
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
import { formatNaira } from "@/lib/format";
import { KPI_VALUE_CLASS } from "@/lib/kpiTypography";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { BarChart3, FileSpreadsheet, Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Redirect } from "wouter";

const MAINT_TYPES = ["Routine", "Repair", "Emergency", "Inspection"] as const;

function BudgetStatusBadge({ status }: { status: "green" | "amber" | "red" }) {
  const map = {
    green: { label: "On track", className: "bg-green-100 text-green-800" },
    amber: { label: "Near limit", className: "bg-amber-100 text-amber-800" },
    red: { label: "Over budget", className: "bg-red-100 text-red-800" },
  };
  const s = map[status];
  return <Badge className={s.className}>{s.label}</Badge>;
}

export default function CostManagement() {
  const year = new Date().getFullYear();
  const utils = trpc.useUtils();
  const { data: budgetVsActual } = trpc.costManagement.budgetVsActual.useQuery({ year });
  const { data: budgets } = trpc.costManagement.listBudgets.useQuery({ period: year });
  const { data: maintCosts } = trpc.costManagement.listMaintenanceCosts.useQuery({
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  });
  const { data: maintSummary } = trpc.costManagement.maintenanceSummary.useQuery({ year });
  const { data: assets } = trpc.assets.list.useQuery(undefined);
  const { data: sites } = trpc.sites.list.useQuery(undefined);

  const [budgetDialog, setBudgetDialog] = useState(false);
  const [budgetSiteId, setBudgetSiteId] = useState<string>("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [costDialog, setCostDialog] = useState(false);
  const [costForm, setCostForm] = useState({
    assetId: "",
    maintenanceType: "Routine" as (typeof MAINT_TYPES)[number],
    date: new Date().toISOString().slice(0, 10),
    costNgn: "",
    description: "",
    referenceNumber: "",
  });

  const upsertBudget = trpc.costManagement.upsertBudget.useMutation({
    onSuccess: () => {
      toast.success("Budget saved");
      void utils.costManagement.listBudgets.invalidate();
      void utils.costManagement.budgetVsActual.invalidate();
      setBudgetDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const createCost = trpc.costManagement.createMaintenanceCost.useMutation({
    onSuccess: () => {
      toast.success("Maintenance cost logged");
      void utils.costManagement.listMaintenanceCosts.invalidate();
      void utils.costManagement.maintenanceSummary.invalidate();
      void utils.costManagement.budgetVsActual.invalidate();
      setCostDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const exportMaint = trpc.costManagement.exportMaintenanceCostsExcel.useMutation({
    onSuccess: (data) => {
      const a = document.createElement("a");
      a.href = `data:${data.mimeType};base64,${data.base64}`;
      a.download = data.filename;
      a.click();
    },
  });

  const exportBudget = trpc.costManagement.exportBudgetSummaryExcel.useMutation({
    onSuccess: (data) => {
      const a = document.createElement("a");
      a.href = `data:${data.mimeType};base64,${data.base64}`;
      a.download = data.filename;
      a.click();
    },
  });

  const branchSites = useMemo(
    () => (sites ?? []).filter((s) => s.facilityType === "branch" && s.isActive),
    [sites]
  );

  return (
    <ManagerFinanceGate>
      <div className="container mx-auto space-y-6 p-6">
        <PageHeader
          icon={BarChart3}
          title="Cost Management"
          subtitle={`Expenditure overview, maintenance costs, and branch budgets (${year}).`}
        />

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Expenditure Overview</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance Costs</TabsTrigger>
            <TabsTrigger value="budget">Budget Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 pt-4">
            <CostAnalyticsOverview />
            <Card>
              <CardHeader>
                <CardTitle>Budget vs actual (branches)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(budgetVsActual ?? []).map((row) => (
                  <div key={row.siteId} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{row.siteName}</span>
                      <span>
                        {formatNaira(row.spend)} / {formatNaira(row.budget)}
                      </span>
                    </div>
                    <Progress value={Math.min(row.percentUsed, 100)} className="h-2" />
                    <div className="flex justify-end">
                      <BudgetStatusBadge status={row.status} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-4 pt-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total maintenance spend</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={KPI_VALUE_CLASS}>{formatNaira(maintSummary?.totalSpend ?? 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Most expensive asset</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">
                    {maintSummary?.topAsset
                      ? `${maintSummary.topAsset.assetCode ?? "—"} · ${formatNaira(maintSummary.topAsset.total)}`
                      : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Most expensive facility</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">
                    {maintSummary?.topFacility
                      ? `${maintSummary.topFacility.facilityName} · ${formatNaira(maintSummary.topFacility.total)}`
                      : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Avg per entry</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={KPI_VALUE_CLASS}>{formatNaira(maintSummary?.avgPerEntry ?? 0)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setCostDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add cost
              </Button>
              <Button
                variant="outline"
                disabled={exportMaint.isPending}
                onClick={() => exportMaint.mutate({ dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` })}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Facility</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(maintCosts ?? []).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.assetCode ?? "—"}</TableCell>
                        <TableCell>{r.assetName}</TableCell>
                        <TableCell>{r.facilityName}</TableCell>
                        <TableCell>{r.maintenanceType}</TableCell>
                        <TableCell>{r.date}</TableCell>
                        <TableCell className="text-right">{formatNaira(r.costNgn)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="budget" className="space-y-4 pt-4">
            <div className="flex gap-2">
              <Button onClick={() => setBudgetDialog(true)}>Set branch budget</Button>
              <Button variant="outline" disabled={exportBudget.isPending} onClick={() => exportBudget.mutate({ year })}>
                {exportBudget.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export Excel
                  </>
                )}
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead className="text-right">Annual budget</TableHead>
                      <TableHead className="text-right">YTD spend</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">% used</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(budgetVsActual ?? []).map((r) => (
                      <TableRow key={r.siteId}>
                        <TableCell>{r.siteName}</TableCell>
                        <TableCell className="text-right">{formatNaira(r.budget)}</TableCell>
                        <TableCell className="text-right">{formatNaira(r.spend)}</TableCell>
                        <TableCell className="text-right">
                          {formatNaira(Math.max(0, r.budget - r.spend))}
                        </TableCell>
                        <TableCell className="text-right">{r.percentUsed}%</TableCell>
                        <TableCell>
                          <BudgetStatusBadge status={r.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={budgetDialog} onOpenChange={setBudgetDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Branch annual budget ({year})</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Branch</Label>
              <Select value={budgetSiteId} onValueChange={setBudgetSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branchSites.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label>Amount (₦)</Label>
              <Input value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} />
            </div>
            <DialogFooter>
              <Button
                disabled={upsertBudget.isPending}
                onClick={() => {
                  const siteId = parseInt(budgetSiteId, 10);
                  const amount = parseFloat(budgetAmount);
                  if (!siteId || !Number.isFinite(amount)) {
                    toast.error("Enter branch and amount");
                    return;
                  }
                  const existing = budgets?.find((b) => b.siteId === siteId && !b.categoryId);
                  upsertBudget.mutate({
                    id: existing?.id,
                    siteId,
                    categoryId: null,
                    period: year,
                    amount,
                  });
                }}
              >
                {upsertBudget.isPending ? (
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

        <Dialog open={costDialog} onOpenChange={setCostDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log maintenance cost</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <Label>Asset</Label>
              <Select
                value={costForm.assetId}
                onValueChange={(v) => setCostForm((f) => ({ ...f, assetId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select asset" />
                </SelectTrigger>
                <SelectContent>
                  {(assets ?? []).slice(0, 500).map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.assetCode ?? a.assetTag} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label>Type</Label>
              <Select
                value={costForm.maintenanceType}
                onValueChange={(v) =>
                  setCostForm((f) => ({ ...f, maintenanceType: v as (typeof MAINT_TYPES)[number] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAINT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label>Date</Label>
              <Input
                type="date"
                value={costForm.date}
                onChange={(e) => setCostForm((f) => ({ ...f, date: e.target.value }))}
              />
              <Label>Cost (₦)</Label>
              <Input
                value={costForm.costNgn}
                onChange={(e) => setCostForm((f) => ({ ...f, costNgn: e.target.value }))}
              />
              <Label>Description</Label>
              <Input
                value={costForm.description}
                onChange={(e) => setCostForm((f) => ({ ...f, description: e.target.value }))}
              />
              <Label>Reference</Label>
              <Input
                value={costForm.referenceNumber}
                onChange={(e) => setCostForm((f) => ({ ...f, referenceNumber: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button
                disabled={createCost.isPending}
                onClick={() => {
                  const assetId = parseInt(costForm.assetId, 10);
                  const costNgn = parseFloat(costForm.costNgn);
                  if (!assetId || !Number.isFinite(costNgn)) {
                    toast.error("Complete required fields");
                    return;
                  }
                  createCost.mutate({
                    assetId,
                    maintenanceType: costForm.maintenanceType,
                    date: costForm.date,
                    costNgn,
                    description: costForm.description || undefined,
                    referenceNumber: costForm.referenceNumber || undefined,
                  });
                }}
              >
                {createCost.isPending ? (
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
    </ManagerFinanceGate>
  );
}

export function CostAnalyticsRedirect() {
  return <Redirect to="/app/finance/cost-management" />;
}

