import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { FileText, Search, Calendar } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function AuditTrail() {
  const [entityType, setEntityType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: logs, isLoading } = trpc.auditLogs.list.useQuery({
    entityType: entityType === "all" ? undefined : entityType,
  });

  const filteredLogs = logs?.filter((log: any) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(searchLower) ||
      (log.entityType && log.entityType.toLowerCase().includes(searchLower)) ||
      (log.changes && log.changes.toLowerCase().includes(searchLower))
    );
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Audit Trail
        </h1>
        <p className="text-muted-foreground">Complete history of all system changes</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by action, entity, or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
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
        </CardContent>
      </Card>

      {/* Audit Log List */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            {filteredLogs?.length || 0} records found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs && filteredLogs.length > 0 ? (
            <div className="space-y-4">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="border-l-4 border-primary pl-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm uppercase tracking-wide">
                          {log.action}
                        </span>
                        <span className="text-xs px-2 py-1 bg-muted rounded">
                          {log.entityType}
                        </span>
                      </div>
                      {log.changes && (
                        <p className="text-sm text-muted-foreground">{log.changes}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(log.timestamp), 'PPpp')}
                        </span>
                        <span>User ID: {log.userId}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No audit logs found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
