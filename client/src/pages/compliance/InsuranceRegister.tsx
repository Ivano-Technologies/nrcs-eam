import { ManagerFinanceGate } from "@/components/finance/ManagerFinanceGate";
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
import { useAuth } from "@/_core/hooks/useAuth";
import { formatNaira } from "@/lib/format";
import { KPI_VALUE_CLASS } from "@/lib/kpiTypography";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AlertTriangle, FileSpreadsheet, Loader2, Plus, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const TYPES = ["Property", "Vehicle", "Equipment", "Liability"] as const;

function statusBadge(status: "active" | "expiring" | "expired") {
  if (status === "active") return <Badge className="bg-green-100 text-green-800">Active</Badge>;
  if (status === "expiring") return <Badge className="bg-amber-100 text-amber-800">Expiring Soon</Badge>;
  return <Badge className="bg-red-100 text-red-800">Expired</Badge>;
}

export function InsuranceRegisterContent({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canManage = user?.role === "admin" || user?.role === "manager";
  const [location] = useLocation();
  const statusFilter = useMemo(() => {
    const q = location.includes("?") ? new URLSearchParams(location.split("?")[1]) : null;
    const s = q?.get("status");
    if (s === "expiring" || s === "expired" || s === "active") return s;
    return undefined;
  }, [location]);

  const utils = trpc.useUtils();
  const { data: rows } = trpc.insuranceRecords.list.useQuery({
    status: statusFilter,
  });

  const summary = useMemo(() => {
    const list = rows ?? [];
    return {
      insured: list.reduce((s, r) => s + r.insuredValueNgn, 0),
      premiums: list.reduce((s, r) => s + r.annualPremiumNgn, 0),
      active: list.filter((r) => r.status === "active").length,
      expiring: list.filter((r) => r.status === "expiring").length,
    };
  }, [rows]);

  const { data: sites } = trpc.sites.list.useQuery(undefined);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    siteId: "",
    insuranceType: "Property" as (typeof TYPES)[number],
    insurer: "",
    policyNumber: "",
    insuredValueNgn: "",
    annualPremiumNgn: "",
    policyStart: "",
    policyEnd: "",
    notes: "",
  });

  const create = trpc.insuranceRecords.create.useMutation({
    onSuccess: () => {
      toast.success("Policy added");
      void utils.insuranceRecords.list.invalidate();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const del = trpc.insuranceRecords.delete.useMutation({
    onSuccess: () => void utils.insuranceRecords.list.invalidate(),
  });

  const exportExcel = trpc.insuranceRecords.exportExcel.useMutation({
    onSuccess: (data) => {
      const a = document.createElement("a");
      a.href = `data:${data.mimeType};base64,${data.base64}`;
      a.download = data.filename;
      a.click();
    },
  });

  const content = (
      <div className={embedded ? "space-y-6" : "container mx-auto space-y-6 p-6"}>
        {summary.expiring > 0 ? (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className="text-sm">
                {summary.expiring} insurance {summary.expiring === 1 ? "policy expires" : "policies expire"} within
                30 days. Review renewals promptly.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {!embedded ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
          <PageHeader
            icon={Shield}
            title="Insurance Register"
            subtitle="Property, vehicle, equipment, and liability policies"
            className="mb-0"
          />
          <div className="flex gap-2">
            {canManage ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add policy
              </Button>
            ) : null}
            {canManage ? (
              <Button variant="outline" disabled={exportExcel.isPending} onClick={() => exportExcel.mutate({})}>
                {exportExcel.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>
        ) : canManage ? (
          <div className="mb-4 flex justify-end gap-2">
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add policy
            </Button>
            <Button variant="outline" disabled={exportExcel.isPending} onClick={() => exportExcel.mutate({})}>
              {exportExcel.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export
                </>
              )}
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total insured value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={KPI_VALUE_CLASS}>{formatNaira(summary.insured)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Annual premiums</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={KPI_VALUE_CLASS}>{formatNaira(summary.premiums)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active policies</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={KPI_VALUE_CLASS}>{summary.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Expiring within 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn(KPI_VALUE_CLASS, summary.expiring > 0 && "text-amber-600")}>{summary.expiring}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset / property</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Insurer</TableHead>
                  <TableHead>Policy #</TableHead>
                  <TableHead className="text-right">Insured</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.assetOrProperty}</TableCell>
                    <TableCell>{r.facilityName}</TableCell>
                    <TableCell>{r.insuranceType}</TableCell>
                    <TableCell>{r.insurer}</TableCell>
                    <TableCell>{r.policyNumber}</TableCell>
                    <TableCell className="text-right">{formatNaira(r.insuredValueNgn)}</TableCell>
                    <TableCell className="text-right">{formatNaira(r.annualPremiumNgn)}</TableCell>
                    <TableCell>{r.policyEnd}</TableCell>
                    <TableCell>{r.daysToRenewal}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    {canManage ? (
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => del.mutate({ id: r.id })}>
                          Delete
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add insurance policy</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <Label>Facility</Label>
              <Select value={form.siteId} onValueChange={(v) => setForm((f) => ({ ...f, siteId: v }))}>
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
              <Label>Type</Label>
              <Select
                value={form.insuranceType}
                onValueChange={(v) => setForm((f) => ({ ...f, insuranceType: v as (typeof TYPES)[number] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label>Insurer</Label>
              <Input value={form.insurer} onChange={(e) => setForm((f) => ({ ...f, insurer: e.target.value }))} />
              <Label>Policy number</Label>
              <Input
                value={form.policyNumber}
                onChange={(e) => setForm((f) => ({ ...f, policyNumber: e.target.value }))}
              />
              <Label>Insured value (₦)</Label>
              <Input
                value={form.insuredValueNgn}
                onChange={(e) => setForm((f) => ({ ...f, insuredValueNgn: e.target.value }))}
              />
              <Label>Annual premium (₦)</Label>
              <Input
                value={form.annualPremiumNgn}
                onChange={(e) => setForm((f) => ({ ...f, annualPremiumNgn: e.target.value }))}
              />
              <Label>Policy start</Label>
              <Input
                type="date"
                value={form.policyStart}
                onChange={(e) => setForm((f) => ({ ...f, policyStart: e.target.value }))}
              />
              <Label>Policy end</Label>
              <Input
                type="date"
                value={form.policyEnd}
                onChange={(e) => setForm((f) => ({ ...f, policyEnd: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button
                disabled={create.isPending}
                onClick={() => {
                  const siteId = parseInt(form.siteId, 10);
                  if (!siteId || !form.insurer || !form.policyNumber) {
                    toast.error("Complete required fields");
                    return;
                  }
                  create.mutate({
                    assetId: null,
                    siteId,
                    insuranceType: form.insuranceType,
                    insurer: form.insurer,
                    policyNumber: form.policyNumber,
                    insuredValueNgn: parseFloat(form.insuredValueNgn) || undefined,
                    annualPremiumNgn: parseFloat(form.annualPremiumNgn) || undefined,
                    policyStart: form.policyStart,
                    policyEnd: form.policyEnd,
                    notes: form.notes || undefined,
                  });
                }}
              >
                {create.isPending ? (
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

  if (embedded) return content;
  return <ManagerFinanceGate>{content}</ManagerFinanceGate>;
}

export default function InsuranceRegister() {
  return <InsuranceRegisterContent />;
}

