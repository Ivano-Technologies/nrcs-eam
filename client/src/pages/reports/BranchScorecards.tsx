import { ManagerFinanceGate } from "@/components/finance/ManagerFinanceGate";
import PageHeader from "@/components/ui/PageHeader";
import PageLoader from "@/components/ui/PageLoader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { appPath } from "@/lib/routes";
import { trpc } from "@/lib/trpc";
import { ArrowDown, ArrowUp, FileDown, Loader2, Trophy } from "lucide-react";
import { useMemo } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function BranchScorecards() {
  const { data, isLoading } = trpc.branchScorecards.list.useQuery();
  const exportXlsx = trpc.branchScorecards.exportXlsx.useMutation({
    onSuccess: (r) => {
      downloadBase64File(r.data, r.filename, r.mimeType);
      toast.success("Branch scorecards exported");
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = useMemo(() => data ?? [], [data]);
  const bestId = rows[0]?.branchId;
  const worstId = rows.length > 1 ? rows[rows.length - 1]?.branchId : undefined;

  if (isLoading) return <PageLoader />;

  return (
    <ManagerFinanceGate>
      <div className="space-y-6" data-testid="branch-scorecards-page">
        <PageHeader
          icon={Trophy}
          title="Branch scorecards"
          subtitle="Composite branch health — verification, maintenance, stock, expiry, and asset pipeline."
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={exportXlsx.isPending}
            onClick={() => exportXlsx.mutate()}
          >
            {exportXlsx.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Export Excel
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead>Verified %</TableHead>
                <TableHead>Overdue WOs</TableHead>
                <TableHead>Stock alerts</TableHead>
                <TableHead>30d expiry qty</TableHead>
                <TableHead>Book value</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow
                  key={row.branchId}
                  data-testid={`scorecard-row-${row.branchId}`}
                  className={
                    row.branchId === bestId
                      ? "bg-green-50/50 dark:bg-green-950/20"
                      : row.branchId === worstId
                        ? "bg-amber-50/50 dark:bg-amber-950/20"
                        : undefined
                  }
                >
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium">
                    {row.branchName}
                    {row.branchId === bestId ? (
                      <Badge className="ml-2 bg-green-100 text-green-800">Top</Badge>
                    ) : null}
                    {row.branchId === worstId ? (
                      <Badge className="ml-2 bg-amber-100 text-amber-800">Needs attention</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-semibold">{row.compositeScore}</TableCell>
                  <TableCell>
                    {row.trendVsPriorMonth == null ? (
                      "—"
                    ) : row.trendVsPriorMonth >= 0 ? (
                      <span className="inline-flex items-center text-green-700">
                        <ArrowUp className="mr-1 h-3 w-3" />
                        {row.trendVsPriorMonth.toFixed(1)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-red-700">
                        <ArrowDown className="mr-1 h-3 w-3" />
                        {row.trendVsPriorMonth.toFixed(1)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{row.verificationPercent}%</TableCell>
                  <TableCell>{row.overdueWorkOrders}</TableCell>
                  <TableCell>{row.stockAlerts}</TableCell>
                  <TableCell>{row.expiryExposure30Day}</TableCell>
                  <TableCell>{formatNaira(row.bookValue)}</TableCell>
                  <TableCell>
                    <Link href={appPath(`/reports?branch=${row.branchId}`)} className="text-sm text-primary hover:underline">
                      Branch summary
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </ManagerFinanceGate>
  );
}
