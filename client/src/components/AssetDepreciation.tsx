import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, DollarSign, Calendar, Percent } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AssetDepreciationProps {
  assetId: number;
}

export default function AssetDepreciation({ assetId }: AssetDepreciationProps) {
  const { data: depreciation, isLoading } = trpc.depreciation.calculate.useQuery({ assetId });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Depreciation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading depreciation data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!depreciation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Depreciation
          </CardTitle>
          <CardDescription>
            No depreciation configured for this asset
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Depreciation Analysis
        </CardTitle>
        <CardDescription>
          {depreciation.method} method
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              Current Book Value
            </div>
            <div className="text-2xl font-bold text-green-600">
              ₦{depreciation.currentBookValue.toLocaleString()}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4" />
              Accumulated Depreciation
            </div>
            <div className="text-2xl font-bold text-red-600">
              ₦{depreciation.accumulatedDepreciation.toLocaleString()}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Percent className="h-4 w-4" />
              Depreciation %
            </div>
            <div className="text-2xl font-bold">
              {depreciation.depreciationPercentage}%
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              Years Remaining
            </div>
            <div className="text-2xl font-bold">
              {depreciation.remainingYears.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Annual Depreciation:</span>
            <span className="font-medium">₦{depreciation.annualDepreciation.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Years Elapsed:</span>
            <span className="font-medium">{depreciation.yearsElapsed.toFixed(2)} years</span>
          </div>
        </div>

        {/* Depreciation Schedule */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Depreciation Schedule</h4>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Beginning Value</TableHead>
                  <TableHead className="text-right">Depreciation</TableHead>
                  <TableHead className="text-right">Accumulated</TableHead>
                  <TableHead className="text-right">Ending Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {depreciation.schedule.map((entry: any) => (
                  <TableRow key={entry.year}>
                    <TableCell className="font-medium">{entry.year}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ₦{entry.beginningValue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      -₦{entry.depreciationExpense.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ₦{entry.accumulatedDepreciation.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₦{entry.endingValue.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
