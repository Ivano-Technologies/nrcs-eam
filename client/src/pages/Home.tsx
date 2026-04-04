import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Wrench, AlertTriangle, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Home() {
  const { user } = useAuth();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: upcomingMaintenance } = trpc.maintenance.upcoming.useQuery({ days: 7 });
  const { data: lowStockItems } = trpc.inventory.lowStock.useQuery();

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
      roles: ["admin", "manager", "technician"],
    },
    {
      title: "Pending Work Orders",
      value: stats?.pendingWorkOrders || 0,
      icon: AlertTriangle,
      description: `${stats?.inProgressWorkOrders || 0} in progress`,
      color: "text-red-700",
      bgColor: "bg-red-50",
      iconBg: "bg-gradient-to-br from-red-600 to-red-700",
      roles: ["admin", "manager", "technician"],
    },
    {
      title: "Low Stock Items",
      value: stats?.lowStockItems || 0,
      icon: TrendingUp,
      description: "Need reordering",
      color: "text-purple-700",
      bgColor: "bg-purple-50",
      iconBg: "bg-gradient-to-br from-purple-500 to-purple-600",
      roles: ["admin", "manager"],
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
          return (
            <Card key={metric.title} className="border-l-4 border-l-primary/20 hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-white to-gray-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">
                  {metric.title}
                </CardTitle>
                <div className={`p-2.5 rounded-xl ${metric.iconBg} shadow-sm`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
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
                <Link href="/maintenance">
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
        <Card className="border-t-4 border-t-orange-500 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Low Stock Alerts</CardTitle>
                <CardDescription>Items below reorder point</CardDescription>
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
                <Link href="/inventory">
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
                <Link href="/maintenance">
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
            <Link href="/assets">
              <Button variant="outline" className="w-full justify-start">
                <Package className="mr-2 h-4 w-4" />
                View Assets
              </Button>
            </Link>
            <Link href="/work-orders">
              <Button variant="outline" className="w-full justify-start">
                <Wrench className="mr-2 h-4 w-4" />
                Work Orders
              </Button>
            </Link>
            <Link href="/maintenance">
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                Maintenance
              </Button>
            </Link>
            <Link href="/inventory">
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
