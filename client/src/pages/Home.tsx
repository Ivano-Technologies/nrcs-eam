import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Wrench, AlertTriangle, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { appPath } from "@/lib/routes";

export default function Home() {
  const { user } = useAuth();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: upcomingMaintenance } = trpc.maintenance.upcoming.useQuery({ days: 7 });
  const { data: lowStockItems } = trpc.inventory.lowStock.useQuery();
  const { data: expiringSoon } = trpc.inventoryV2.expiry.upcoming.useQuery({ days: 30 });
  const { data: criticalStock } = trpc.inventoryV2.stock.overview.useQuery({ status: "critical" });
  const { data: lowStockV2 } = trpc.inventoryV2.stock.overview.useQuery({ status: "low" });
  const { data: recentCounts } = trpc.inventoryV2.counts.list.useQuery();
  const { data: reqs } = trpc.inventoryV2.requisitions.list.useQuery();
  const { data: dists } = trpc.inventoryV2.distributions.list.useQuery();
  const { data: distReport } = trpc.inventoryV2.distributions.report.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Role-based metrics
  const allMetrics = [
    {
      title: "Total Assets",
      value: stats?.totalAssets || 0,
      icon: Package,
      description: `${stats?.operationalAssets || 0} operational`,
      color: "text-blue-700",
      bgColor: "bg-blue-100",
      iconBg: "bg-gradient-to-br from-blue-500 to-blue-600",
      roles: ["admin", "manager"],
    },
    {
      title: "Assets in Maintenance",
      value: stats?.maintenanceAssets || 0,
      icon: Wrench,
      description: "Currently being serviced",
      color: "text-orange-700",
      bgColor: "bg-orange-50",
      iconBg: "bg-gradient-to-br from-orange-500 to-orange-600",
      roles: ["admin", "manager", "staff"],
    },
    {
      title: "Pending Work Orders",
      value: stats?.pendingWorkOrders || 0,
      icon: AlertTriangle,
      description: `${stats?.inProgressWorkOrders || 0} in progress`,
      color: "text-red-700",
      bgColor: "bg-red-50",
      iconBg: "bg-gradient-to-br from-red-600 to-red-700",
      roles: ["admin", "manager", "staff"],
    },
    {
      title: "Low Stock Items",
      value: lowStockV2?.length || stats?.lowStockItems || 0,
      icon: TrendingUp,
      description: "Need reordering",
      color: "text-purple-700",
      bgColor: "bg-purple-50",
      iconBg: "bg-gradient-to-br from-purple-500 to-purple-600",
      roles: ["admin", "manager"],
    },
    {
      title: "Critical Stock",
      value: criticalStock?.length || 0,
      icon: AlertTriangle,
      description: "Below safety stock",
      color: "text-red-700",
      bgColor: "bg-red-50",
      iconBg: "bg-gradient-to-br from-rose-500 to-rose-700",
      roles: ["admin", "manager"],
    },
    {
      title: "Expiring in 30 Days",
      value: expiringSoon?.length || 0,
      icon: Calendar,
      description: "Batches nearing expiry",
      color: "text-amber-700",
      bgColor: "bg-amber-50",
      iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
      roles: ["admin", "manager"],
    },
    {
      title: "Active Requisitions",
      value: (reqs ?? []).filter((x) => ["submitted", "branch_approved", "hq_approved"].includes(String(x.status))).length,
      icon: AlertTriangle,
      description: "Pending approval",
      color: "text-blue-700",
      bgColor: "bg-blue-50",
      iconBg: "bg-gradient-to-br from-blue-500 to-blue-700",
      roles: ["admin", "manager", "staff"],
    },
    {
      title: "Emergency Requisitions",
      value: (reqs ?? []).filter((x) => x.priority === "emergency" && x.status !== "fulfilled").length,
      icon: AlertTriangle,
      description: "High urgency",
      color: "text-red-700",
      bgColor: "bg-red-50",
      iconBg: "bg-gradient-to-br from-red-500 to-red-700 animate-pulse",
      roles: ["admin", "manager", "staff"],
    },
    {
      title: "Recent Distributions",
      value: (dists ?? []).length,
      icon: TrendingUp,
      description: "Last 30 days",
      color: "text-green-700",
      bgColor: "bg-green-50",
      iconBg: "bg-gradient-to-br from-green-500 to-green-700",
      roles: ["admin", "manager", "staff"],
    },
    {
      title: "Beneficiaries Reached",
      value: distReport?.beneficiaries ?? 0,
      icon: TrendingUp,
      description: "With positive trend",
      color: "text-indigo-700",
      bgColor: "bg-indigo-50",
      iconBg: "bg-gradient-to-br from-indigo-500 to-indigo-700",
      roles: ["admin", "manager", "staff"],
    },
  ];

  // Filter metrics based on user role
  const metrics = allMetrics.filter(metric => 
    !user?.role || metric.roles.includes(user.role)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your asset management system
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const metricTestId =
            metric.title === "Total Assets"
              ? "dashboard-metric-total-assets"
              : metric.title === "Pending Work Orders"
                ? "dashboard-metric-pending-work-orders"
                : undefined;
          return (
            <Card
              key={metric.title}
              data-testid={metricTestId}
              className="border-l-4 border-l-primary/20 hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-white to-gray-50"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">
                  {metric.title}
                </CardTitle>
                <div className={`p-2.5 rounded-xl ${metric.iconBg} shadow-sm`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid={metricTestId ? `${metricTestId}-value` : undefined}>
                  {metric.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metric.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming Maintenance */}
        <Card className="border-t-4 border-t-blue-500 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Upcoming Maintenance</CardTitle>
                <CardDescription>Next 7 days</CardDescription>
              </div>
              <div className="p-2 rounded-lg bg-blue-100">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingMaintenance && upcomingMaintenance.length > 0 ? (
              <div className="space-y-3">
                {upcomingMaintenance.slice(0, 5).map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{schedule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {new Date(schedule.nextDue).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
                <Link href={appPath("/maintenance")}>
                  <Button variant="outline" size="sm" className="w-full">
                    View All Schedules
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming maintenance scheduled</p>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="border-t-4 border-t-orange-500 shadow-md hover:shadow-lg transition-shadow" data-testid="dashboard-low-stock-widget">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Low Stock Alerts</CardTitle>
                <CardDescription>Items below minimum stock level</CardDescription>
              </div>
              <div className="p-2 rounded-lg bg-orange-100">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {lowStockItems && lowStockItems.length > 0 ? (
              <div className="space-y-3">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Stock: {item.currentStock} {item.unitOfMeasure}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-orange-600">
                      Reorder
                    </span>
                  </div>
                ))}
                <Link href={appPath("/inventory")}>
                  <Button variant="outline" size="sm" className="w-full">
                    View Inventory
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">All inventory levels are adequate</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-t-4 border-t-indigo-500 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Recent Cycle Counts</CardTitle>
          <CardDescription>Recent sessions and variance alerts</CardDescription>
        </CardHeader>
        <CardContent>
          {(recentCounts ?? []).slice(0, 5).length ? (
            <div className="space-y-2">
              {(recentCounts ?? []).slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div>
                    <p className="font-medium">{c.countNumber}</p>
                    <p className="text-muted-foreground">{c.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{c.varianceCount ?? 0} variances</p>
                  </div>
                </div>
              ))}
              <Link href={appPath("/inventory/counts")}>
                <Button variant="outline" size="sm">Open Stock Counts</Button>
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent count sessions.</p>
          )}
        </CardContent>
      </Card>

      {/* Analytics Widgets */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Assets by Status */}
        <Card className="border-t-4 border-t-blue-500">
          <CardHeader>
            <CardTitle className="text-base">Assets by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Operational</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500" 
                      style={{ width: `${stats?.totalAssets ? (stats.operationalAssets / stats.totalAssets * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{stats?.operationalAssets || 0}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Maintenance</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500" 
                      style={{ width: `${stats?.totalAssets ? (stats.maintenanceAssets / stats.totalAssets * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{stats?.maintenanceAssets || 0}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Retired</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gray-500" 
                      style={{ width: `${stats?.totalAssets ? (((stats as any).retiredAssets || 0) / stats.totalAssets * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{(stats as any)?.retiredAssets || 0}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overdue Maintenance */}
        <Card className="border-t-4 border-t-red-500">
          <CardHeader>
            <CardTitle className="text-base">Overdue Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-red-600">{(stats as any)?.overdueMaintenance || 0}</div>
              <p className="text-sm text-muted-foreground mt-2">Tasks past due date</p>
              {((stats as any)?.overdueMaintenance || 0) > 0 && (
                <Link href={appPath("/maintenance")}>
                  <Button size="sm" variant="outline" className="mt-4">
                    View Tasks
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Work Order Completion Rate */}
        <Card className="border-t-4 border-t-purple-500">
          <CardHeader>
            <CardTitle className="text-base">Work Order Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-purple-600">
                {(stats as any)?.totalWorkOrders ? Math.round(((stats as any).completedWorkOrders / (stats as any).totalWorkOrders) * 100) : 0}%
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {(stats as any)?.completedWorkOrders || 0} of {(stats as any)?.totalWorkOrders || 0} completed
              </p>
              <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500" 
                  style={{ width: `${(stats as any)?.totalWorkOrders ? ((stats as any).completedWorkOrders / (stats as any).totalWorkOrders * 100) : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-t-4 border-t-green-500 shadow-md">       <CardHeader>
          <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href={appPath("/assets")}>
              <Button variant="outline" className="w-full justify-start">
                <Package className="mr-2 h-4 w-4" />
                View Assets
              </Button>
            </Link>
            <Link href={appPath("/work-orders")}>
              <Button variant="outline" className="w-full justify-start">
                <Wrench className="mr-2 h-4 w-4" />
                Work Orders
              </Button>
            </Link>
            <Link href={appPath("/maintenance")}>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                Maintenance
              </Button>
            </Link>
            <Link href={appPath("/inventory")}>
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="mr-2 h-4 w-4" />
                Inventory
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
