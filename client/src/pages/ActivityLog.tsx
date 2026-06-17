import { useState } from "react";
import { trpc } from "@/lib/trpc";
import TableLoader from "@/components/ui/TableLoader";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Activity } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ActivityLog() {
  const { user } = useAuth();
  const [userQuery, setUserQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [entityType, setEntityType] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.auditLogs.list.useQuery({
    entityType: entityType === "all" ? undefined : entityType,
    actionType: actionFilter !== "all" ? actionFilter : undefined,
    userQuery: userQuery.trim() ? userQuery.trim() : undefined,
    facilityId: facilityFilter !== "all" ? Number(facilityFilter) : undefined,
    startDate: startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined,
    endDate: endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined,
    page,
    pageSize: 25,
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-xl text-muted-foreground">Admin access required</p>
      </div>
    );
  }

  const actionTypes = data?.actionTypes ?? [];
  const facilities = data?.facilities ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 25));

  const rows = (data?.rows ?? []).filter((log) => {
    if (!searchQuery.trim()) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(searchLower) ||
      (log.resource?.toLowerCase().includes(searchLower) ?? false) ||
      (log.details?.toLowerCase().includes(searchLower) ?? false) ||
      log.userLabel.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="Activity Log"
        subtitle="Audit trail of user actions and system changes"
      />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by date range, user, action, entity type, and facility</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search action, resource, details, or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="User name/email..."
                value={userQuery}
                onChange={(e) => {
                  setUserQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={entityType}
              onValueChange={(value) => {
                setEntityType(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entity types</SelectItem>
                <SelectItem value="asset">Assets</SelectItem>
                <SelectItem value="work_order">Work Orders</SelectItem>
                <SelectItem value="site">Facilities</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={actionFilter}
              onValueChange={(value) => {
                setActionFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Action type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actionTypes.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={facilityFilter}
              onValueChange={(value) => {
                setFacilityFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Facility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All facilities</SelectItem>
                {facilities.map((facility) => (
                  <SelectItem key={facility.id} value={String(facility.id)}>
                    {facility.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableLoader className="py-8" />
      ) : rows.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div
              className="frozen-table-wrap"
              style={
                {
                  "--col1-width": "200px",
                  "--col2-width": "200px",
                } as Record<string, string>
              }
            >
              <Table className="min-w-[1100px]">
                <TableHeader className="bg-background">
                  <TableRow>
                    <TableHead className="bg-background">Timestamp</TableHead>
                    <TableHead className="bg-background">User</TableHead>
                    <TableHead className="bg-background">Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Facility</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="bg-background">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="bg-background">{log.userLabel}</TableCell>
                      <TableCell className="bg-background">{log.action}</TableCell>
                      <TableCell>{log.resource}</TableCell>
                      <TableCell>{log.details ?? "-"}</TableCell>
                      <TableCell>{log.facilityName ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages} · {data?.total ?? 0} records
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border px-3 py-1 disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="rounded border px-3 py-1 disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No activity recorded yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
