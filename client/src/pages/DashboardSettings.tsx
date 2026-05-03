import { useAuth } from "@/_core/hooks/useAuth";
import { DashboardWidgetSettings } from "@/components/DashboardWidgetSettings";
import { OpenRegistrationSettings } from "@/components/OpenRegistrationSettings";
import { InstallPWAButton } from "@/components/InstallPWAButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Camera, Loader2, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export default function DashboardSettings() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [profileName, setProfileName] = useState("");
  /** `undefined` = not edited; `null` = cleared; string = new URL */
  const [avatarOverride, setAvatarOverride] = useState<string | null | undefined>(undefined);
  const [photoUrlField, setPhotoUrlField] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

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
    if (!user) return;
    setProfileName(user.name ?? "");
    setAvatarOverride(undefined);
    setPhotoUrlField("");
  }, [user?.id, user?.name, user?.avatarUrl]);

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

  const sendAssetCheckRemindersMutation = trpc.notifications.sendAssetCheckReminders.useMutation({
    onSuccess: (r) => {
      toast.success(`Asset check reminders: ${r.sent} sent, ${r.failed} failed, ${r.facilitiesProcessed} facilities`);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success("Profile saved");
      setAvatarOverride(undefined);
      await utils.auth.me.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const uploadAvatarMutation = trpc.auth.uploadAvatar.useMutation();

  const displayAvatar =
    avatarOverride !== undefined ? avatarOverride : (user?.avatarUrl ?? null);

  const profileDirty = useMemo(() => {
    if (!user) return false;
    const nameChanged = profileName.trim() !== (user.name ?? "").trim();
    const avatarChanged =
      avatarOverride !== undefined &&
      (avatarOverride ?? null) !== (user.avatarUrl ?? null);
    return nameChanged || avatarChanged;
  }, [user, profileName, avatarOverride]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5MB or smaller");
      return;
    }
    if (!allowedMimeTypes.includes(file.type as (typeof allowedMimeTypes)[number])) {
      toast.error("Please choose an image file");
      return;
    }
    setUploadingAvatar(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== "string") {
            reject(new Error("Failed to read file"));
            return;
          }
          const [, base64] = result.split(",", 2);
          if (!base64) {
            reject(new Error("Failed to encode image"));
            return;
          }
          resolve(base64);
        };
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const data = await uploadAvatarMutation.mutateAsync({
        fileName: file.name,
        mimeType: file.type as (typeof allowedMimeTypes)[number],
        dataBase64,
      });
      setAvatarOverride(data.url);
      toast.success("Photo uploaded — save to apply");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const applyPhotoUrl = () => {
    const raw = photoUrlField.trim();
    if (!raw) {
      toast.error("Paste an image URL first");
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      toast.error("Enter a valid URL");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      toast.error("URL must use http:// or https://");
      return;
    }
    setAvatarOverride(raw);
    toast.success("Photo URL applied — save to confirm");
  };

  const saveProfile = () => {
    if (!user) return;
    const name = profileName.trim();
    if (!name) {
      toast.error("Name cannot be empty");
      return;
    }
    const payload: { name?: string; avatarUrl?: string } = {};
    if (name !== (user.name ?? "").trim()) {
      payload.name = name;
    }
    if (avatarOverride !== undefined) {
      const next = avatarOverride ?? null;
      const cur = user.avatarUrl ?? null;
      if (next !== cur) {
        payload.avatarUrl = next === null ? "" : next;
      }
    }
    if (Object.keys(payload).length === 0) {
      toast.info("No changes to save");
      return;
    }
    updateProfileMutation.mutate(payload);
  };

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
    <div className="space-y-6 max-w-full min-w-0">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2 break-words">Account, appearance, and preferences</p>
      </div>

      <Card id="profile-settings" className="scroll-mt-24 max-w-full overflow-hidden">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your display name and photo appear in the sidebar. Email is managed by your sign-in provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-3 sm:items-start">
              <Avatar className="h-24 w-24 border-2 border-border">
                {displayAvatar ? (
                  <AvatarImage src={displayAvatar} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="text-2xl font-medium">
                  {(profileName.trim().charAt(0) || user?.name?.charAt(0) || "?").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <input
                  ref={avatarFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={uploadingAvatar}
                  onClick={() => avatarFileRef.current?.click()}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  {uploadingAvatar ? "Uploading…" : "Upload photo"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!displayAvatar && avatarOverride === undefined}
                  onClick={() => setAvatarOverride(null)}
                >
                  Remove photo
                </Button>
              </div>
            </div>
            <div className="flex-1 space-y-4 min-w-0 max-w-full">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Display name</Label>
                <Input
                  id="profile-name"
                  autoComplete="name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-photo-url">Photo URL (optional)</Label>
                <div className="flex flex-col gap-2 sm:flex-row min-w-0">
                  <Input
                    id="profile-photo-url"
                    placeholder="https://…"
                    value={photoUrlField}
                    onChange={(e) => setPhotoUrlField(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" onClick={applyPhotoUrl} className="sm:self-auto self-start">
                    Use URL
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground break-words">
                  Use upload above, or paste a direct link to an image. Save to apply changes.
                </p>
              </div>
              <div className="grid gap-1 text-sm border-t pt-4">
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <span className="font-medium">{user?.email ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Role: </span>
                  <span className="font-medium capitalize">{user?.role ?? "—"}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={saveProfile}
              disabled={!profileDirty || updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save profile"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPwdOpen(true)}>
              Change password
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-full overflow-hidden">
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

      <Card className="max-w-full overflow-hidden">
        <CardHeader>
          <CardTitle>Install App</CardTitle>
          <CardDescription>
            Install NRCS EAM as a standalone app on your device for quick access and a better experience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InstallPWAButton />
          <div className="mt-4 rounded-lg bg-muted p-4 text-sm space-y-2 max-w-full">
            <p className="font-medium">Benefits of installing:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground break-words">
              <li>Quick access from your home screen or desktop</li>
              <li>Full-screen experience without browser UI</li>
              <li>Faster load times</li>
              <li>Native app feel on mobile and desktop</li>
              <li>Offline access (coming soon)</li>
            </ul>
          </div>
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
        <Card>
          <CardHeader>
            <CardTitle>Asset physical check reminders</CardTitle>
            <CardDescription>
              Email branch managers (or facility contact) for assets with no check or last check older than 6 months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              disabled={sendAssetCheckRemindersMutation.isPending}
              onClick={() => sendAssetCheckRemindersMutation.mutate()}
            >
              {sendAssetCheckRemindersMutation.isPending ? "Sending…" : "Send reminder emails now"}
            </Button>
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
