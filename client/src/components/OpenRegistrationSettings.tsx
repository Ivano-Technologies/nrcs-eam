import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";

export function OpenRegistrationSettings() {
  const { data, isLoading, refetch } = trpc.appSettings.getOpenRegistration.useQuery();
  const mutation = trpc.appSettings.setOpenRegistration.useMutation({
    onSuccess: () => refetch(),
  });
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (data?.openRegistration !== undefined) {
      setOpen(data.openRegistration);
    }
  }, [data?.openRegistration]);

  const handleToggle = async (checked: boolean) => {
    setOpen(checked);
    await mutation.mutateAsync({ openRegistration: checked });
  };

  return (
    <Card data-testid="settings-open-registration">
      <CardHeader>
        <CardTitle>Registration</CardTitle>
        <CardDescription>
          New signups always submit an access request for admin approval; no account is created until
          approved. This toggle is retained for compatibility and does not change that behavior.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <Label htmlFor="open-registration" className="text-base font-medium cursor-pointer">
            Open Registration
          </Label>
          <Switch
            id="open-registration"
            checked={open}
            disabled={isLoading || mutation.isPending}
            onCheckedChange={handleToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}
