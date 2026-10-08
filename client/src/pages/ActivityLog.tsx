import { useState } from "react";
import { trpc } from "@/lib/trpc";
import TableLoader from "@/components/ui/TableLoader";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMobileTableColumns, MobileColumnsToggle, mobileSecondaryCol } from "@/hooks/useMobileTableColumns";
import { cn } from "@/lib/utils";
import { Search, Activity } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatActivityAction, formatActivityDetails, formatActivityResource } from "@/lib/activityLog";
import { DATE_INPUT_HINT, formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ActivityLog() {
  const { user } = useAuth();
  const { isMobile, showAllColumns, showAll, setShowAll } = useMobileTableColumns();
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
      formatActivityAction(log.action).toLowerCase().includes(searchLower) ||
      formatActivityResource(log.resource, log.userLabel).toLowerCase().includes(searchLower) ||
      formatActivityDetails(log.details).toLowerCase().includes(searchLower) ||
      log.userLabel.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="Activity log"
        subtitle="Audit trail of user actions and system changes"
      />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by date range, user, action, entity type and facility</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search action, resource, details, or user…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="User name or email…"
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
                <SelectItem value="work_order">Work orders</SelectItem>
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
                    {formatActivityAction(action)}
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
              aria-label="Start date"
              aria-describedby="activity-date-hint"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
            <Input
              type="date"
              aria-label="End date"
              aria-describedby="activity-date-hint"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <p id="activity-date-hint" className="text-xs text-muted-foreground">Dates use {DATE_INPUT_HINT}.</p>
            <MobileColumnsToggle isMobile={isMobile} showAll={showAll} onToggle={setShowAll} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableLoader className="py-8" />
      ) : rows.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div
              className="frozen-table-wrap sticky-first-col"
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
                    <TableHead className={cn(mobileSecondaryCol(showAllColumns))}>Resource</TableHead>
                    <TableHead className={cn(mobileSecondaryCol(showAllColumns))}>Details</TableHead>
                    <TableHead className={cn(mobileSecondaryCol(showAllColumns))}>Facility</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="bg-background">
                        {formatDateTime(log.timestamp)}
                      </TableCell>
                      <TableCell className="bg-background">{log.userLabel}</TableCell>
                      <TableCell className="bg-background">{formatActivityAction(log.action)}</TableCell>
                      <TableCell className={cn(mobileSecondaryCol(showAllColumns))}>{formatActivityResource(log.resource, log.userLabel)}</TableCell>
                      <TableCell
                        className={cn("max-w-[24rem] truncate", mobileSecondaryCol(showAllColumns))}
                        title={formatActivityDetails(log.details) || undefined}
                      >
                        {formatActivityDetails(log.details)}
                      </TableCell>
                      <TableCell className={cn("min-w-[12rem] whitespace-normal", mobileSecondaryCol(showAllColumns))}>
                        {log.facilityName ?? ""}
                      </TableCell>
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
          <CardContent className="p-0">
            <EmptyState icon={Activity} title="No activity yet" body="Activity appears here once someone signs in or changes a record." />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
