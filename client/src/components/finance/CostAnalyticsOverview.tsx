import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { formatNaira } from "@/lib/format";
import { KPI_VALUE_CLASS } from "@/lib/kpiTypography";
import { DollarSign, TrendingUp, Wrench, Building2, Users, Loader2 } from "lucide-react";
import { useState } from "react";
import { ModuleFiltersCard } from "@/components/ModuleFiltersCard";

export function CostAnalyticsOverview() {
  const [days, setDays] = useState(30);
  const { data: analytics, isLoading } = trpc.financial.getCostAnalytics.useQuery({ days });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleFiltersCard
        filterRow={
          <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v, 10))}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 180 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={KPI_VALUE_CLASS}>{formatNaira(analytics?.totalCost ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={KPI_VALUE_CLASS}>{formatNaira(analytics?.maintenanceCost ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repairs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={KPI_VALUE_CLASS}>{formatNaira(analytics?.repairCost ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost by Category</CardTitle>
          <CardDescription>Expenses breakdown by asset category</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics?.byCategory?.length ? (
            <div className="space-y-4">
              {analytics.byCategory.map((cat) => (
                <div key={cat.categoryId} className="flex items-center justify-between">
                  <span className="font-medium">{cat.categoryName}</span>
                  <span className="font-bold">{formatNaira(cat.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No category data available</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Cost by Site
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics?.bySite?.length ? (
            <div className="space-y-4">
              {analytics.bySite.map((site) => (
                <div key={site.siteId} className="flex items-center justify-between">
                  <span className="font-medium">{site.siteName}</span>
                  <span className="font-bold">{formatNaira(site.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No site data available</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top Vendors
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics?.byVendor?.length ? (
            <div className="space-y-4">
              {analytics.byVendor.map((vendor) => (
                <div key={vendor.vendorId} className="flex items-center justify-between">
                  <div>
                    <span className="font-medium block">{vendor.vendorName}</span>
                    <span className="text-xs text-muted-foreground">
                      {vendor.transactionCount} transactions
                    </span>
                  </div>
                  <span className="font-bold">{formatNaira(vendor.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No vendor data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
