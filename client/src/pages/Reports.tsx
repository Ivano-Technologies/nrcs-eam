import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileText, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Reports() {
  const [reportType, setReportType] = useState<string>("assetInventory");
  const [format, setFormat] = useState<"pdf" | "excel">("pdf");
  const [siteId, setSiteId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const { data: sites } = trpc.sites.list.useQuery();
  const { data: categories } = trpc.assetCategories.list.useQuery();

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

  const handleGenerateReport = async () => {
    try {
      let result;

      switch (reportType) {
        case "assetInventory":
          result = await assetInventoryMutation.mutateAsync({
            format,
            siteId: siteId && siteId !== 'all' ? parseInt(siteId) : undefined,
            categoryId: categoryId && categoryId !== 'all' ? parseInt(categoryId) : undefined,
            status: status && status !== 'all' ? (status as any) : undefined,
            startDate,
            endDate,
          });
          break;

        case "maintenanceSchedule":
          result = await maintenanceScheduleMutation.mutateAsync({
            format,
            siteId: siteId && siteId !== 'all' ? parseInt(siteId) : undefined,
            startDate,
            endDate,
          });
          break;

        case "workOrders":
          result = await workOrdersMutation.mutateAsync({
            format,
            siteId: siteId && siteId !== 'all' ? parseInt(siteId) : undefined,
            status: status && status !== 'all' ? (status as any) : undefined,
            startDate,
            endDate,
          });
          break;

        case "financial":
          result = await financialMutation.mutateAsync({
            format,
            startDate,
            endDate,
          });
          break;

        case "compliance":
          result = await complianceMutation.mutateAsync({
            format,
            siteId: siteId && siteId !== 'all' ? parseInt(siteId) : undefined,
            status: status && status !== 'all' ? (status as any) : undefined,
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

  const reportTypes = [
    { value: "assetInventory", label: "Asset Inventory", icon: FileText },
    { value: "maintenanceSchedule", label: "Maintenance Schedule", icon: FileText },
    { value: "workOrders", label: "Work Orders", icon: FileText },
    { value: "financial", label: "Financial Summary", icon: FileSpreadsheet },
    { value: "compliance", label: "Compliance Audit", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Generate and export comprehensive reports</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Report Configuration */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
            <CardDescription>Select report type and filters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
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
                <SelectTrigger>
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
                <Label>Site (Optional)</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sites</SelectItem>
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
                    {categories?.map((cat: any) => (
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

            {(reportType === "maintenanceSchedule" ||
              reportType === "workOrders" ||
              reportType === "financial") && (
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

            <Button onClick={handleGenerateReport} disabled={isGenerating} className="w-full">
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

        {/* Report Types */}
        <div className="space-y-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Asset Inventory
              </CardTitle>
              <CardDescription>Complete list of all assets with details and status</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Maintenance Schedule
              </CardTitle>
              <CardDescription>Upcoming and overdue maintenance tasks</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Work Orders
              </CardTitle>
              <CardDescription>All work orders with status and completion details</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Financial Summary
              </CardTitle>
              <CardDescription>Asset costs, maintenance expenses, and budget tracking</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Compliance Audit
              </CardTitle>
              <CardDescription>Compliance status and inspection records</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
