import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Mail, Edit2, Trash2, Save, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";


export default function Users() {
  const { user } = useAuth();

  const { data: users, isLoading } = trpc.users.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const updateRoleMutation = trpc.users.updateRole.useMutation();
  const updateUserMutation = trpc.users.update.useMutation();
  const deleteUserMutation = trpc.users.delete.useMutation();
  const utils = trpc.useUtils();

  const [roleChangeDialog, setRoleChangeDialog] = useState<{
    open: boolean;
    userId?: number;
    userName?: string;
    currentRole?: string;
    newRole?: string;
  }>({ open: false });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    userId?: number;
    userName?: string;
  }>({ open: false });

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editData, setEditData] = useState<{ name: string; email: string }>({ name: "", email: "" });

  const handleRoleChange = (userId: number, userName: string, currentRole: string, newRole: string) => {
    setRoleChangeDialog({
      open: true,
      userId,
      userName,
      currentRole,
      newRole,
    });
  };

  const confirmRoleChange = async () => {
    if (!roleChangeDialog.userId || !roleChangeDialog.newRole) return;

    try {
      await updateRoleMutation.mutateAsync({
        userId: roleChangeDialog.userId,
        role: roleChangeDialog.newRole as 'admin' | 'manager' | 'technician' | 'user',
      });
      
      utils.users.list.invalidate();
      toast.success(`Role updated: ${roleChangeDialog.userName}'s role has been changed to ${roleChangeDialog.newRole}`);
      setRoleChangeDialog({ open: false });
    } catch (error: any) {
      toast.error(`Error: ${error.message || 'Failed to update user role'}`);
    }
  };

  const handleStartEdit = (userId: number, name: string, email: string) => {
    setEditingUserId(userId);
    setEditData({ name, email });
  };

  const handleSaveEdit = async (userId: number) => {
    if (!editData.name || !editData.email) {
      toast.error("Name and email are required");
      return;
    }

    try {
      await updateUserMutation.mutateAsync({
        id: userId,
        name: editData.name,
        email: editData.email,
      });
      utils.users.list.invalidate();
      toast.success("User updated successfully");
      setEditingUserId(null);
    } catch (error: any) {
      toast.error(`Failed to update user: ${error.message}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditData({ name: "", email: "" });
  };

  const handleDeleteClick = (userId: number, userName: string) => {
    setDeleteDialog({
      open: true,
      userId,
      userName,
    });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.userId) return;

    try {
      await deleteUserMutation.mutateAsync({ id: deleteDialog.userId });
      utils.users.list.invalidate();
      toast.success(`User ${deleteDialog.userName} deleted successfully`);
      setDeleteDialog({ open: false });
    } catch (error: any) {
      toast.error(`Failed to delete user: ${error.message}`);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-xl text-muted-foreground">Admin access required</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  const getRoleBadgeColor = (role: string) => {
    const colors = { 
      admin: "bg-red-100 text-red-800", 
      manager: "bg-blue-100 text-blue-800", 
      technician: "bg-green-100 text-green-800", 
      user: "bg-gray-100 text-gray-800" 
    };
    return colors[role as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground mt-2">Manage system users and roles</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users?.map((u) => (
          <Card key={u.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <User className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    {editingUserId === u.id ? (
                      <Input 
                        value={editData.name} 
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="h-8 text-lg font-semibold"
                      />
                    ) : (
                      <CardTitle className="text-lg">{u.name || "No Name"}</CardTitle>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getRoleBadgeColor(u.role)}>{u.role}</Badge>
                  {u.id !== user?.id && (
                    editingUserId === u.id ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(u.id)}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleStartEdit(u.id, u.name || "", u.email || "")}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(u.id, u.name || "User")}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {editingUserId === u.id ? (
                  <div className="space-y-2">
                    <Label className="text-xs">Email</Label>
                    <Input 
                      type="email"
                      value={editData.email} 
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                ) : (
                  u.email && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>{u.email}</span>
                    </div>
                  )
                )}
                {u.loginMethod && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Login:</span> {u.loginMethod}
                  </p>
                )}
                <p className="text-muted-foreground">
                  <span className="font-medium">Last Sign In:</span>{" "}
                  {new Date(u.lastSignedIn).toLocaleDateString()}
                </p>
                
                {/* Role Management */}
                {editingUserId !== u.id && (
                  <div className="pt-2 border-t">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Change Role
                    </label>
                    <Select
                      value={u.role}
                      onValueChange={(newRole) => handleRoleChange(u.id, u.name || 'User', u.role, newRole)}
                      disabled={u.id === user?.id} // Prevent changing own role
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="technician">Technician</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                    {u.id === user?.id && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Cannot change your own role or delete yourself
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Role Change Confirmation Dialog */}
      <Dialog open={roleChangeDialog.open} onOpenChange={(open) => setRoleChangeDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription>
              Are you sure you want to change {roleChangeDialog.userName}'s role from{" "}
              <span className="font-semibold">{roleChangeDialog.currentRole}</span> to{" "}
              <span className="font-semibold">{roleChangeDialog.newRole}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleChangeDialog({ open: false })}
            >
              Cancel
            </Button>
            <Button onClick={confirmRoleChange} disabled={updateRoleMutation.isPending}>
              {updateRoleMutation.isPending ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm User Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user <span className="font-semibold">{deleteDialog.userName}</span>? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false })}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete} 
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
