import { useAuth } from "@/_core/hooks/useAuth";
import { DashboardWidgetSettings } from "@/components/DashboardWidgetSettings";
import { OpenRegistrationSettings } from "@/components/OpenRegistrationSettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function DashboardSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [notif, setNotif] = useState({
    newUserRequests: true,
    lowStockAlerts: true,
    overdueMaintenance: true,
  });
  const [notifDirty, setNotifDirty] = useState(false);

  const { data: emailSettings, isLoading: emailLoading } = trpc.appSettings.getEmailNotificationSettings.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (emailSettings) {
      setNotif({
        newUserRequests: emailSettings.newUserRequests,
        lowStockAlerts: emailSettings.lowStockAlerts,
        overdueMaintenance: emailSettings.overdueMaintenance,
      });
      setNotifDirty(false);
    }
  }, [emailSettings]);

  const setEmailMutation = trpc.appSettings.setEmailNotificationSettings.useMutation({
    onSuccess: () => {
      toast.success("Notification settings saved");
      setNotifDirty(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password updated");
      setPwdOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e) => toast.error(e.message),
  });

  const { refetch: refetchExportZip, isFetching: exportZipLoading } =
    trpc.bulkOperations.exportAllDataZip.useQuery(undefined, {
      enabled: false,
    });

  const handleExportZip = async () => {
    try {
      const { data: r, error } = await refetchExportZip();
      if (error || !r) {
        toast.error("Export failed");
        return;
      }
      const byteCharacters = atob(r.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: r.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    }
  };

  const submitPassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Account, appearance, and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose a light or dark interface. System follows your device setting.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {mounted && (
            <>
              <Button
                type="button"
                variant={theme === "light" ? "default" : "outline"}
                className="gap-2"
                onClick={() => setTheme("light")}
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                type="button"
                variant={theme === "dark" ? "default" : "outline"}
                className="gap-2"
                onClick={() => setTheme("dark")}
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
              <Button
                type="button"
                variant={theme === "system" ? "default" : "outline"}
                className="gap-2"
                onClick={() => setTheme("system")}
              >
                <Monitor className="h-4 w-4" />
                System
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your profile and sign-in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1 text-sm">
            <div>
              <span className="text-muted-foreground">Name: </span>
              <span className="font-medium">{user?.name ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email: </span>
              <span className="font-medium">{user?.email ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Role: </span>
              <span className="font-medium">{user?.role ?? "—"}</span>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => setPwdOpen(true)}>
            Change Password
          </Button>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Email alerts for administrators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="n1" className="flex-1">
                    Email notifications for new user requests
                  </Label>
                  <Switch
                    id="n1"
                    checked={notif.newUserRequests}
                    onCheckedChange={(v) => {
                      setNotif((s) => ({ ...s, newUserRequests: v }));
                      setNotifDirty(true);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="n2" className="flex-1">
                    Email notifications for low stock alerts
                  </Label>
                  <Switch
                    id="n2"
                    checked={notif.lowStockAlerts}
                    onCheckedChange={(v) => {
                      setNotif((s) => ({ ...s, lowStockAlerts: v }));
                      setNotifDirty(true);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="n3" className="flex-1">
                    Email notifications for overdue maintenance
                  </Label>
                  <Switch
                    id="n3"
                    checked={notif.overdueMaintenance}
                    onCheckedChange={(v) => {
                      setNotif((s) => ({ ...s, overdueMaintenance: v }));
                      setNotifDirty(true);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  disabled={!notifDirty || setEmailMutation.isPending}
                  onClick={() =>
                    setEmailMutation.mutate({
                      newUserRequests: notif.newUserRequests,
                      lowStockAlerts: notif.lowStockAlerts,
                      overdueMaintenance: notif.overdueMaintenance,
                    })
                  }
                >
                  {setEmailMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle>Data &amp; Privacy</CardTitle>
            <CardDescription>Export a full copy of key operational data (admin only).</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" onClick={handleExportZip} disabled={exportZipLoading}>
              Export all data (ZIP)
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && <OpenRegistrationSettings />}

      <DashboardWidgetSettings />

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="cur">Current password</Label>
              <Input
                id="cur"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nw">New password</Label>
              <Input
                id="nw"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf">Confirm new password</Label>
              <Input
                id="cf"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPwdOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitPassword}
              disabled={
                changePasswordMutation.isPending ||
                !currentPassword ||
                !newPassword ||
                newPassword.length < 8
              }
            >
              {changePasswordMutation.isPending ? "Updating…" : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
