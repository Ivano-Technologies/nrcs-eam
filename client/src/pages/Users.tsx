import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type AppRole = "admin" | "manager" | "staff" | "field" | "user";
type UserStatus = "active" | "inactive" | "pending";

function roleLabel(role: string): string {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  if (role === "staff") return "Staff";
  if (role === "field") return "Field";
  return "Field";
}

function roleBadgeClass(role: string): string {
  if (role === "admin") return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  if (role === "manager") return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
  if (role === "staff") return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
  return "bg-muted text-muted-foreground";
}

function statusLabel(s: string): string {
  if (s === "active") return "Active";
  if (s === "inactive") return "Inactive";
  if (s === "pending") return "Pending";
  return s;
}

export default function Users() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [facilityFilter, setFacilityFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");

  const listInput = useMemo(
    () => ({
      search: search.trim() || undefined,
      role: roleFilter === "all" ? undefined : roleFilter,
      facilityId: facilityFilter === "all" ? undefined : facilityFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
    [search, roleFilter, facilityFilter, statusFilter]
  );

  const { data: rows, isLoading } = trpc.users.list.useQuery(listInput, {
    enabled: user?.role === "admin",
  });

  const { data: sites } = trpc.sites.list.useQuery(undefined, {
    staleTime: 60_000,
    enabled: user?.role === "admin",
  });
  const activeSites = useMemo(
    () => (sites ?? []).filter((s) => s.isActive !== false),
    [sites]
  );

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("User created");
      void utils.users.list.invalidate();
      setCreateOpen(false);
      setCreateForm({
        name: "",
        email: "",
        role: "staff" as AppRole,
        facilityId: null as number | null,
        sendWelcomeEmail: true,
      });
    },
    onError: (e) => toast.error(e.message || "Create failed"),
  });

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("User updated");
      void utils.users.list.invalidate();
      setEditOpen(false);
    },
    onError: (e) => toast.error(e.message || "Update failed"),
  });

  const deactivateMutation = trpc.users.deactivate.useMutation({
    onSuccess: () => {
      toast.success("User deactivated");
      void utils.users.list.invalidate();
      setDeactivateId(null);
    },
    onError: (e) => toast.error(e.message || "Deactivate failed"),
  });

  const resetPasswordMutation = trpc.users.resetPassword.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (e) => toast.error(e.message || "Reset failed"),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    role: "staff" as AppRole,
    facilityId: null as number | null,
    sendWelcomeEmail: true,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<{
    id: number;
    name: string;
    email: string | null;
    role: AppRole;
    facilityId: number | null;
    status: UserStatus;
  } | null>(null);

  const [deactivateId, setDeactivateId] = useState<number | null>(null);

  const deactivateTarget = useMemo(
    () => rows?.find((r) => r.id === deactivateId),
    [rows, deactivateId]
  );

  if (user?.role !== "admin") {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <p className="text-xl text-muted-foreground">Admin access required</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="mt-2 text-muted-foreground">Create accounts, assign facilities, and manage access</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0 gap-2">
          <UserPlus className="h-4 w-4" />
          Add user
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:flex-wrap md:items-end">
        <div className="min-w-[200px] flex-1 space-y-2">
          <Label htmlFor="user-search">Search</Label>
          <Input
            id="user-search"
            placeholder="Name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full min-w-[140px] space-y-2 md:w-40">
          <Label>Role</Label>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AppRole | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="field">Field</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full min-w-[160px] space-y-2 md:w-48">
          <Label>Facility</Label>
          <Select
            value={facilityFilter === "all" ? "all" : String(facilityFilter)}
            onValueChange={(v) => setFacilityFilter(v === "all" ? "all" : Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="All facilities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All facilities</SelectItem>
              {activeSites.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full min-w-[140px] space-y-2 md:w-40">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as UserStatus | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table
          className="table-freeze min-w-[1100px]"
          style={
            {
              "--sticky-col-1-width": "180px",
              "--sticky-col-2-width": "260px",
            } as Record<string, string>
          }
        >
          <TableHeader className="bg-background">
            <TableRow>
              <TableHead className="table-col-sticky-1 bg-background">Name</TableHead>
              <TableHead className="table-col-sticky-2 bg-background">Email</TableHead>
              <TableHead className="table-col-sticky-3 bg-background">Role</TableHead>
              <TableHead>Facility</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last sign in</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((u) => {
              const st = (u as { status?: string }).status ?? "active";
              const facilityName = (u as { facilityName?: string | null }).facilityName ?? null;
              return (
                <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                  <TableCell className="table-col-sticky-1 font-medium bg-background">{u.name || "—"}</TableCell>
                  <TableCell className="table-col-sticky-2 max-w-[220px] truncate bg-background">{u.email || "—"}</TableCell>
                  <TableCell className="table-col-sticky-3 bg-background">
                    <Badge className={roleBadgeClass(u.role)} variant="secondary">
                      {roleLabel(u.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{facilityName ?? "—"}</TableCell>
                  <TableCell>{statusLabel(st)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                    {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditRow({
                            id: u.id,
                            name: u.name ?? "",
                            email: u.email,
                            role: u.role as AppRole,
                            facilityId: u.siteId ?? null,
                            status: (st as UserStatus) || "active",
                          });
                          setEditOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!u.email || u.id === user.id}
                        onClick={() => u.email && resetPasswordMutation.mutate({ email: u.email })}
                      >
                        Reset password
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={u.id === user.id || st === "inactive"}
                        onClick={() => setDeactivateId(u.id)}
                      >
                        Deactivate
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {(rows?.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-muted-foreground">No users match your filters.</p>
        ) : null}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Creates a Supabase Auth account and an app profile. A temporary password is emailed when welcome email
              is enabled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-name">Full name</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={createForm.role}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v as AppRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="field">Field</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assigned facility (optional)</Label>
              <Select
                value={createForm.facilityId != null ? String(createForm.facilityId) : "none"}
                onValueChange={(v) =>
                  setCreateForm((f) => ({ ...f, facilityId: v === "none" ? null : Number(v) }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {activeSites.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="welcome-email">Send welcome email</Label>
                <p className="text-xs text-muted-foreground">Includes temporary password and login link</p>
              </div>
              <Switch
                id="welcome-email"
                checked={createForm.sendWelcomeEmail}
                onCheckedChange={(c) => setCreateForm((f) => ({ ...f, sendWelcomeEmail: c }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createMutation.isPending || !createForm.name.trim() || !createForm.email.trim()}
              onClick={() =>
                createMutation.mutate({
                  name: createForm.name.trim(),
                  email: createForm.email.trim(),
                  role: createForm.role,
                  facilityId: createForm.facilityId,
                  sendWelcomeEmail: createForm.sendWelcomeEmail,
                })
              }
            >
              {createMutation.isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditRow(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Email cannot be changed (Supabase). Update profile and access here.</DialogDescription>
          </DialogHeader>
          {editRow ? (
            <>
              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Full name</Label>
                  <Input
                    id="edit-name"
                    value={editRow.name}
                    onChange={(e) => setEditRow((r) => (r ? { ...r, name: e.target.value } : r))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={editRow.email ?? ""} disabled readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-user-role">Role</Label>
                  <Select
                    value={editRow.role}
                    onValueChange={(v) => setEditRow((r) => (r ? { ...r, role: v as AppRole } : r))}
                  >
                    <SelectTrigger id="edit-user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="field">Field</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assigned facility</Label>
                  <Select
                    value={editRow.facilityId != null ? String(editRow.facilityId) : "none"}
                    onValueChange={(v) =>
                      setEditRow((r) =>
                        r ? { ...r, facilityId: v === "none" ? null : Number(v) } : r
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {activeSites.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editRow.status}
                    onValueChange={(v) => setEditRow((r) => (r ? { ...r, status: v as UserStatus } : r))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={updateMutation.isPending || !editRow.name.trim()}
                  onClick={() =>
                    updateMutation.mutate({
                      id: editRow.id,
                      name: editRow.name.trim(),
                      role: editRow.role,
                      facilityId: editRow.facilityId,
                      status: editRow.status,
                    })
                  }
                >
                  {updateMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deactivateId != null} onOpenChange={(o) => !o && setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget
                ? `This will mark ${deactivateTarget.name ?? deactivateTarget.email} inactive. They will not be removed from Supabase Auth.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivateMutation.isPending || deactivateId == null}
              onClick={() => deactivateId != null && deactivateMutation.mutate({ id: deactivateId })}
            >
              {deactivateMutation.isPending ? "Working…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
