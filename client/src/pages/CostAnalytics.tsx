import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { DollarSign, TrendingUp, Wrench, Building2, Users } from "lucide-react";
import { useState } from "react";

export default function CostAnalytics() {
  const [days, setDays] = useState(30);
  const { data: analytics, isLoading } = trpc.financial.getCostAnalytics.useQuery({ days });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cost Analytics</h1>
          <p className="text-muted-foreground">Maintenance and operational cost breakdown</p>
        </div>
        <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
          <SelectTrigger className="w-[180px]">
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
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{analytics?.totalCost.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              All expenses in selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{analytics?.maintenanceCost.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Preventive maintenance costs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repairs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{analytics?.repairCost.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Emergency repair costs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Cost by Category</CardTitle>
          <CardDescription>Expenses breakdown by asset category</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics?.byCategory && analytics.byCategory.length > 0 ? (
            <div className="space-y-4">
              {analytics.byCategory.map((cat) => (
                <div key={cat.categoryId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <span className="font-medium">{cat.categoryName}</span>
                  </div>
                  <span className="font-bold">₦{cat.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No category data available</p>
          )}
        </CardContent>
      </Card>

      {/* Cost by Site */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Cost by Site
          </CardTitle>
          <CardDescription>Expenses breakdown by location</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics?.bySite && analytics.bySite.length > 0 ? (
            <div className="space-y-4">
              {analytics.bySite.map((site) => (
                <div key={site.siteId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="font-medium">{site.siteName}</span>
                  </div>
                  <span className="font-bold">₦{site.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No site data available</p>
          )}
        </CardContent>
      </Card>

      {/* Top Vendors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top Vendors
          </CardTitle>
          <CardDescription>Highest spending by vendor</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics?.byVendor && analytics.byVendor.length > 0 ? (
            <div className="space-y-4">
              {analytics.byVendor.map((vendor) => (
                <div key={vendor.vendorId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div>
                      <span className="font-medium block">{vendor.vendorName}</span>
                      <span className="text-xs text-muted-foreground">
                        {vendor.transactionCount} transactions
                      </span>
                    </div>
                  </div>
                  <span className="font-bold">₦{vendor.total.toLocaleString()}</span>
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
