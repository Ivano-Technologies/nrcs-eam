import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Activity, User, Clock } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ActivityLog() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const { data: logs, isLoading } = trpc.auditLogs.list.useQuery({
    entityType: entityFilter !== "all" ? entityFilter : undefined,
  });

  if (user?.role !== "admin" && user?.role !== "manager") {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-xl text-muted-foreground">Manager or Admin access required</p>
      </div>
    );
  }

  const filteredLogs = logs?.filter((log) =>
    searchTerm === "" ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.entityType?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (log.changes?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const getActionBadgeColor = (action: string) => {
    if (action.includes("create")) return "bg-green-100 text-green-800";
    if (action.includes("update")) return "bg-blue-100 text-blue-800";
    if (action.includes("delete")) return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="h-8 w-8" />
          Activity Log
        </h1>
        <p className="text-muted-foreground mt-2">
          Track all user actions and system changes
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter activity by type or search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actions, entities, or details..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="asset">Assets</SelectItem>
                <SelectItem value="work_order">Work Orders</SelectItem>
                <SelectItem value="site">Sites</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="vendor">Vendors</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filteredLogs && filteredLogs.length > 0 ? (
        <div className="space-y-4">
          {filteredLogs.map((log) => (
            <Card key={log.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getActionBadgeColor(log.action)}>
                        {log.action}
                      </Badge>
                      <Badge variant="outline">{log.entityType}</Badge>
                    </div>
                    
                    {log.changes && (
                      <p className="text-sm text-muted-foreground">
                        {log.changes}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>User ID: {log.userId}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No activity found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
