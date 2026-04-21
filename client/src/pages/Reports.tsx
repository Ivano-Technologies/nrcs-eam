import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { appPath } from "@/lib/routes";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type ReportTypeKey =
  | "assetInventory"
  | "maintenanceSchedule"
  | "workOrders"
  | "financial"
  | "compliance";

export default function Reports() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [reportType, setReportType] = useState<string>("assetInventory");
  const [format, setFormat] = useState<"pdf" | "excel">("pdf");
  const [siteId, setSiteId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const { data: sites } = trpc.sites.list.useQuery();
  const { data: categories } = trpc.assetCategories.list.useQuery();
  const { data: insights } = trpc.dashboard.weeklyInsights.useQuery();

  const assetInventoryMutation = trpc.reports.assetInventory.useMutation();
  const maintenanceScheduleMutation = trpc.reports.maintenanceSchedule.useMutation();
  const workOrdersMutation = trpc.reports.workOrders.useMutation();
  const financialMutation = trpc.reports.financial.useMutation();
  const complianceMutation = trpc.reports.compliance.useMutation();

  const isGenerating =
    assetInventoryMutation.isPending ||
    maintenanceScheduleMutation.isPending ||
    workOrdersMutation.isPending ||
    financialMutation.isPending ||
    complianceMutation.isPending;

  const downloadReport = (data: string, filename: string, mimeType: string) => {
    const byteCharacters = atob(data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const runReport = async (type: ReportTypeKey, fmt: "pdf" | "excel") => {
    try {
      let result: { data: string; filename: string; mimeType: string } | undefined;

      switch (type) {
        case "assetInventory":
          result = await assetInventoryMutation.mutateAsync({
            format: fmt,
            siteId: siteId && siteId !== "all" ? parseInt(siteId, 10) : undefined,
            categoryId: categoryId && categoryId !== "all" ? parseInt(categoryId, 10) : undefined,
            status: status && status !== "all" ? (status as "operational" | "maintenance" | "retired" | "disposed") : undefined,
            startDate,
            endDate,
          });
          break;
        case "maintenanceSchedule":
          result = await maintenanceScheduleMutation.mutateAsync({
            format: fmt,
            siteId: siteId && siteId !== "all" ? parseInt(siteId, 10) : undefined,
            startDate,
            endDate,
          });
          break;
        case "workOrders":
          result = await workOrdersMutation.mutateAsync({
            format: fmt,
            siteId: siteId && siteId !== "all" ? parseInt(siteId, 10) : undefined,
            status:
              status && status !== "all"
                ? (status as "pending" | "in_progress" | "completed" | "cancelled")
                : undefined,
            startDate,
            endDate,
          });
          break;
        case "financial":
          result = await financialMutation.mutateAsync({
            format: fmt,
            startDate,
            endDate,
          });
          break;
        case "compliance":
          result = await complianceMutation.mutateAsync({
            format: fmt,
            siteId: siteId && siteId !== "all" ? parseInt(siteId, 10) : undefined,
            status:
              status && status !== "all"
                ? (status as "compliant" | "non_compliant" | "pending")
                : undefined,
          });
          break;
        default:
          throw new Error("Invalid report type");
      }

      if (result) {
        downloadReport(result.data, result.filename, result.mimeType);
        toast.success("Report generated successfully");
      }
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    }
  };

  const handleGenerateReport = async () => {
    await runReport(reportType as ReportTypeKey, format);
  };

  const reportTypes: { value: ReportTypeKey; label: string; icon: typeof FileText }[] = [
    { value: "assetInventory", label: "Asset Inventory", icon: FileText },
    { value: "maintenanceSchedule", label: "Maintenance Schedule", icon: FileText },
    { value: "workOrders", label: "Work Orders", icon: FileText },
    { value: "financial", label: "Financial Summary", icon: FileSpreadsheet },
    { value: "compliance", label: "Compliance Audit", icon: FileText },
  ];

  const borderFor = (t: ReportTypeKey) => {
    const map: Record<ReportTypeKey, string> = {
      assetInventory: "border-l-blue-500",
      maintenanceSchedule: "border-l-orange-500",
      workOrders: "border-l-red-500",
      financial: "border-l-green-500",
      compliance: "border-l-purple-500",
    };
    return map[t];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Generate and export comprehensive reports</p>
      </div>

      {insights && (
        <Card className="border-primary/30 bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Weekly insights</CardTitle>
            <CardDescription>Quick counts — click to open the related area</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <Link
                href={appPath("/maintenance")}
                className="rounded-lg border bg-background p-3 transition-colors hover:bg-accent/50"
              >
                <p className="text-xs text-muted-foreground">Maintenance due (30 days)</p>
                <p className="text-2xl font-semibold tabular-nums">{insights.maintenanceDueNext30Days}</p>
              </Link>
              <Link
                href={appPath("/warranty-alerts")}
                className="rounded-lg border bg-background p-3 transition-colors hover:bg-accent/50"
              >
                <p className="text-xs text-muted-foreground">Warranties expiring (30 days)</p>
                <p className="text-2xl font-semibold tabular-nums">{insights.warrantiesExpiringNext30Days}</p>
              </Link>
              <Link
                href={appPath("/inventory")}
                className="rounded-lg border bg-background p-3 transition-colors hover:bg-accent/50"
              >
                <p className="text-xs text-muted-foreground">Low stock items</p>
                <p className="text-2xl font-semibold tabular-nums">{insights.lowStockItems}</p>
              </Link>
              <Link
                href={appPath("/work-orders")}
                className="rounded-lg border bg-background p-3 transition-colors hover:bg-accent/50"
              >
                <p className="text-xs text-muted-foreground">Overdue work orders</p>
                <p className="text-2xl font-semibold tabular-nums">{insights.overdueWorkOrders}</p>
              </Link>
              {isAdmin ? (
                <Link
                  href={appPath("/pending-users")}
                  className="rounded-lg border bg-background p-3 transition-colors hover:bg-accent/50"
                >
                  <p className="text-xs text-muted-foreground">Pending user requests</p>
                  <p className="text-2xl font-semibold tabular-nums">{insights.pendingUserRequests}</p>
                </Link>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/20 p-3 opacity-60">
                  <p className="text-xs text-muted-foreground">Pending user requests</p>
                  <p className="text-sm text-muted-foreground">Admin only</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
            <CardDescription>Select report type and filters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger data-testid="report-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as "pdf" | "excel")}>
                <SelectTrigger data-testid="report-format-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      PDF Document
                    </div>
                  </SelectItem>
                  <SelectItem value="excel">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Excel Spreadsheet
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(reportType === "assetInventory" ||
              reportType === "maintenanceSchedule" ||
              reportType === "workOrders" ||
              reportType === "compliance") && (
              <div className="space-y-2">
                <Label>Facility (optional)</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All facilities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All facilities</SelectItem>
                    {sites?.map((site) => (
                      <SelectItem key={site.id} value={site.id.toString()}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {reportType === "assetInventory" && (
              <div className="space-y-2">
                <Label>Category (Optional)</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories?.map((cat: { id: number; name: string }) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(reportType === "assetInventory" || reportType === "workOrders" || reportType === "compliance") && (
              <div className="space-y-2">
                <Label>Status (Optional)</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {reportType === "assetInventory" && (
                      <>
                        <SelectItem value="operational">Operational</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                        <SelectItem value="disposed">Disposed</SelectItem>
                      </>
                    )}
                    {reportType === "workOrders" && (
                      <>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </>
                    )}
                    {reportType === "compliance" && (
                      <>
                        <SelectItem value="compliant">Compliant</SelectItem>
                        <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(reportType === "maintenanceSchedule" || reportType === "workOrders" || reportType === "financial") && (
              <>
                <div className="space-y-2">
                  <Label>Start Date (Optional)</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date (Optional)</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </>
            )}

            <Button data-testid={`pdf-generate-${reportType}`} onClick={handleGenerateReport} disabled={isGenerating} className="w-full">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Generate Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {reportTypes.map((rt) => (
            <Card key={rt.value} className={cn("border-l-4", borderFor(rt.value))}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <rt.icon className="h-5 w-5" />
                  {rt.label}
                </CardTitle>
                <CardDescription>
                  {rt.value === "assetInventory" && "Complete list of all assets with details and status"}
                  {rt.value === "maintenanceSchedule" && "Upcoming and overdue maintenance tasks"}
                  {rt.value === "workOrders" && "All work orders with status and completion details"}
                  {rt.value === "financial" && "Asset costs, maintenance expenses, and budget tracking"}
                  {rt.value === "compliance" && "Compliance status and inspection records"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isGenerating}
                  onClick={() => runReport(rt.value, "pdf")}
                >
                  <FileText className="mr-1 h-3.5 w-3.5" />
                  Download PDF
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isGenerating}
                  onClick={() => runReport(rt.value, "excel")}
                >
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                  Export Excel
                </Button>
                <Button type="button" size="sm" variant="secondary" asChild>
                  <Link href={appPath("/report-scheduling")}>
                    <Calendar className="mr-1 h-3.5 w-3.5" />
                    Schedule
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
