import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ClipboardCheck, Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-green-100 text-green-800">Active</Badge>;
  if (status === "closed") return <Badge variant="secondary">Closed</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

export default function VerificationCampaigns() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    startsAt: "",
    endsAt: "",
  });

  const utils = trpc.useUtils();
  const { data: campaigns, isLoading } = trpc.verification.listCampaigns.useQuery();
  const progress = trpc.verification.campaignProgress.useQuery(
    { campaignId: selectedId ?? 0 },
    { enabled: selectedId != null }
  );
  const discrepancies = trpc.verification.discrepancies.useQuery(
    { campaignId: selectedId ?? 0 },
    { enabled: selectedId != null }
  );

  const createMutation = trpc.verification.create.useMutation({
    onSuccess: () => {
      toast.success("Campaign created");
      setCreateOpen(false);
      setForm({ name: "", startsAt: "", endsAt: "" });
      void utils.verification.listCampaigns.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const activateMutation = trpc.verification.activate.useMutation({
    onSuccess: () => {
      toast.success("Campaign activated");
      void utils.verification.listCampaigns.invalidate();
      if (selectedId) void utils.verification.campaignProgress.invalidate({ campaignId: selectedId });
    },
    onError: (e) => toast.error(e.message),
  });
  const closeMutation = trpc.verification.close.useMutation({
    onSuccess: () => {
      toast.success("Campaign closed");
      void utils.verification.listCampaigns.invalidate();
      if (selectedId) void utils.verification.campaignProgress.invalidate({ campaignId: selectedId });
    },
    onError: (e) => toast.error(e.message),
  });

  const selected = useMemo(
    () => (campaigns ?? []).find((c) => c.id === selectedId) ?? null,
    [campaigns, selectedId]
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading campaigns…
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="verification-campaigns-page">
      <PageHeader
        icon={ClipboardCheck}
        title="Verification campaigns"
        subtitle="National asset verification drives — progress, discrepancies, and close-out."
      />

      {isAdmin ? (
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New campaign
        </Button>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(campaigns ?? []).map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    data-testid={`campaign-row-${c.id}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.startsAt).toLocaleDateString()} — {new Date(c.endsAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Progress</CardTitle>
            {selected && isAdmin ? (
              <div className="flex gap-2">
                {selected.status === "draft" ? (
                  <Button size="sm" variant="outline" onClick={() => activateMutation.mutate({ id: selected.id })}>
                    Activate
                  </Button>
                ) : null}
                {selected.status === "active" ? (
                  <Button size="sm" onClick={() => closeMutation.mutate({ id: selected.id })}>
                    Close campaign
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a campaign to view progress.</p>
            ) : progress.data ? (
              <>
                <p className="text-sm">
                  Overall: <strong>{progress.data.percentComplete}%</strong> ({progress.data.totalVerified} / {progress.data.totalAssets})
                </p>
                <div className="space-y-2">
                  {progress.data.perSite.map((site) => (
                    <div key={site.siteId} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{site.siteName}</span>
                        <span>{site.percent}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${Math.min(100, site.percent)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {(discrepancies.data ?? []).length > 0 ? (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Location discrepancies</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Asset</TableHead>
                          <TableHead>Registered</TableHead>
                          <TableHead>Verified at</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(discrepancies.data ?? []).map((row) => (
                          <TableRow key={row.assetId}>
                            <TableCell>{row.assetTag}</TableCell>
                            <TableCell>{row.registeredSiteName}</TableCell>
                            <TableCell>{row.verifiedSiteName}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No location discrepancies recorded.</p>
                )}
              </>
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create verification campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Starts</Label>
              <Input type="date" value={form.startsAt} onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Ends</Label>
              <Input type="date" value={form.endsAt} onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!form.name || !form.startsAt || !form.endsAt || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  name: form.name,
                  startsAt: new Date(form.startsAt),
                  endsAt: new Date(form.endsAt),
                })
              }
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
