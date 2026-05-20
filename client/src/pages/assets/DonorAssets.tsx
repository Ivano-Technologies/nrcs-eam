import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { downloadBase64File } from "@/lib/download";
import { formatNaira } from "@/lib/format";
import { KPI_VALUE_CLASS } from "@/lib/kpiTypography";
import { trpc } from "@/lib/trpc";
import TableLoader from "@/components/ui/TableLoader";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

type DonorBreakdownRow = inferRouterOutputs<AppRouter>["donorAssets"]["report"]["donors"][number];
type DonorAssetRow = DonorBreakdownRow["assets"][number];
import { ChevronDown, ChevronRight, FileSpreadsheet, Gift } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

export default function DonorAssets() {
  const { user } = useAuth();
  const canExport = user?.role === "admin" || user?.role === "manager";

  const [donor, setDonor] = useState<string>("all");
  const [siteId, setSiteId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filters = useMemo(
    () => ({
      donor: donor !== "all" ? donor : undefined,
      siteId: siteId !== "all" ? parseInt(siteId, 10) : undefined,
      categoryId: categoryId !== "all" ? parseInt(categoryId, 10) : undefined,
      yearFrom: yearFrom ? parseInt(yearFrom, 10) : undefined,
      yearTo: yearTo ? parseInt(yearTo, 10) : undefined,
    }),
    [donor, siteId, categoryId, yearFrom, yearTo]
  );

  const { data: report, isLoading } = trpc.donorAssets.report.useQuery(filters);
  const { data: sites } = trpc.sites.list.useQuery(undefined);
  const { data: categories } = trpc.assetCategories.list.useQuery();

  const exportExcel = trpc.donorAssets.exportExcel.useMutation({
    onSuccess: (data) => {
      downloadBase64File(data.base64, data.filename, data.mimeType);
      toast.success("Export downloaded");
    },
    onError: (e) => toast.error(e.message),
  });

  const donorOptions = useMemo((): string[] => {
    const names = new Set((report?.donors ?? []).map((d) => d.donor));
    return Array.from(names).sort();
  }, [report?.donors]);

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Gift className="h-8 w-8 text-primary" />
            Donor Assets
          </h1>
          <p className="text-muted-foreground">
            Donor-funded assets from the register — acquisition and book values by donor
          </p>
        </div>
        {canExport ? (
          <Button
            variant="outline"
            disabled={exportExcel.isPending}
            onClick={() => exportExcel.mutate(filters)}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total donor-funded assets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={KPI_VALUE_CLASS}>{report?.summary.totalAssets ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total acquisition value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={KPI_VALUE_CLASS}>{formatNaira(report?.summary.totalAcquisitionNgn ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total current book value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={KPI_VALUE_CLASS}>{formatNaira(report?.summary.totalBookNgn ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distinct donors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={KPI_VALUE_CLASS}>{report?.summary.distinctDonors ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div>
            <Label>Donor</Label>
            <Select value={donor} onValueChange={setDonor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All donors</SelectItem>
                {donorOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Facility / branch</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All facilities</SelectItem>
                {(sites ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Year from</Label>
            <Input value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} placeholder="e.g. 2018" />
          </div>
          <div>
            <Label>Year to</Label>
            <Input value={yearTo} onChange={(e) => setYearTo(e.target.value)} placeholder="e.g. 2026" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Donor</TableHead>
                <TableHead className="text-right">Assets</TableHead>
                <TableHead className="text-right">Acquisition (₦)</TableHead>
                <TableHead className="text-right">Book value (₦)</TableHead>
                <TableHead>Categories</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <TableLoader />
                  </TableCell>
                </TableRow>
              ) : (report?.donors ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No donor-funded assets match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                (report?.donors ?? []).map((row: DonorBreakdownRow) => (
                  <Fragment key={row.donor}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggle(row.donor)}
                    >
                      <TableCell>
                        {expanded.has(row.donor) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.donor}</TableCell>
                      <TableCell className="text-right">{row.assetCount}</TableCell>
                      <TableCell className="text-right">{formatNaira(row.totalAcquisitionNgn)}</TableCell>
                      <TableCell className="text-right">{formatNaira(row.totalBookNgn)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.categories.map((c: string) => (
                            <Badge key={c} variant="secondary">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded.has(row.donor) ? (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={6} className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Asset code</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Facility</TableHead>
                                <TableHead>Year</TableHead>
                                <TableHead className="text-right">Acquisition (₦)</TableHead>
                                <TableHead className="text-right">Book (₦)</TableHead>
                                <TableHead>Condition</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {row.assets.map((a: DonorAssetRow) => (
                                <TableRow key={a.id}>
                                  <TableCell>{a.assetCode}</TableCell>
                                  <TableCell>{a.name}</TableCell>
                                  <TableCell>{a.categoryName}</TableCell>
                                  <TableCell>{a.facilityName}</TableCell>
                                  <TableCell>{a.yearAcquired ?? "—"}</TableCell>
                                  <TableCell className="text-right">
                                    {formatNaira(a.acquisitionValueNgn)}
                                  </TableCell>
                                  <TableCell className="text-right">{formatNaira(a.bookValueNgn)}</TableCell>
                                  <TableCell>{a.condition ?? "—"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
