import { useState } from "react";
import { Toolbar } from "@/components/Toolbar";
import { InventoryShellActions } from "@/components/inventory/InventoryShell";
import { DateHint, formatEmpty } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import PageHeader from "@/components/ui/PageHeader";
import { HandHeart as HandHeartIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ViewToggle } from "@/components/ViewToggle";
import { useViewMode } from "@/hooks/useViewMode";
import { toast } from "sonner";
import { toFriendlyMessage } from "@/lib/friendlyError";
import { downloadBase64File } from "@/lib/download";
import { Loader2 } from "lucide-react";

export default function Distributions({ embedInShell = false }: { embedInShell?: boolean } = {}) {
  const [viewMode, setViewMode] = useViewMode("inventory_distributions");
  const [open, setOpen] = useState(false);
  const [incident, setIncident] = useState("");
  const [location, setLocation] = useState("");
  const [waybillId, setWaybillId] = useState("");
  const [distributionDate, setDistributionDate] = useState("");
  const [locationType, setLocationType] = useState("community center");
  const [householdCount, setHouseholdCount] = useState("");
  const [beneficiaryCount, setBeneficiaryCount] = useState("");
  const [maleCount, setMaleCount] = useState("");
  const [femaleCount, setFemaleCount] = useState("");
  const [childrenCount, setChildrenCount] = useState("");
  const [elderlyCount, setElderlyCount] = useState("");
  const [pwdCount, setPwdCount] = useState("");
  const [observers, setObservers] = useState("");
  const [notes, setNotes] = useState("");
  const [challenges, setChallenges] = useState("");

  const waybills = trpc.inventoryV2.waybills.list.useQuery({ status: "dispatched" });
  const list = trpc.inventoryV2.distributions.list.useQuery({ incidentReference: incident || undefined, location: location || undefined });
  const createMutation = trpc.inventoryV2.distributions.create.useMutation({
    onSuccess: () => {
      toast.success("Distribution created");
      setOpen(false);
      void list.refetch();
    },
    onError: (e) => toast.error(toFriendlyMessage(e)),
  });
  const downloadPdfMutation = trpc.inventoryV2.distributions.downloadPdf.useMutation({
    onError: (e) => toast.error(toFriendlyMessage(e)),
  });

  const newDistributionButton = (
    <Button className="h-9" data-testid="new-dist-btn" onClick={() => setOpen(true)}>
      New distribution
    </Button>
  );

  return (
    <div className="space-y-6">
      <InventoryShellActions>{newDistributionButton}</InventoryShellActions>
      {!embedInShell ? (
        <>
          <PageHeader icon={HandHeartIcon} title="Distributions" actions={newDistributionButton} />
          <InventorySecondaryNav />
        </>
      ) : null}
      <Toolbar
        filters={
          <>
            <Input placeholder="Incident" aria-label="Incident" className="h-9 w-36" value={incident} onChange={(e) => setIncident(e.target.value)} />
            <Input placeholder="Location" aria-label="Location" className="h-9 w-36" value={location} onChange={(e) => setLocation(e.target.value)} />
          </>
        }
        end={<ViewToggle value={viewMode} onChange={setViewMode} />}
      />
      {viewMode === "card" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(list.data ?? []).map((row) => (
            <Card size="sm" key={row.id} data-testid={`dist-row-${row.distributionNumber}`}>
              <CardContent className="space-y-2">
                <p className="font-mono text-sm">{row.distributionNumber}</p>
                <p className="font-semibold">{row.location}</p>
                <p className="text-xs text-muted-foreground">{row.distributionDate}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="frozen-table-wrap rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-2 py-2 text-left">Distribution no.</th>
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Location</th>
                <th className="px-2 py-2 text-left">Beneficiaries</th>
                <th className="px-2 py-2 text-left">Households</th>
                <th className="px-2 py-2 text-left">Conducted by</th>
                <th className="px-2 py-2 text-left">Incident</th>
                <th className="px-2 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((row) => (
                <tr key={row.id} data-testid={`dist-row-${row.distributionNumber}`} className="border-b">
                  <td className="px-2 py-2 font-mono">{row.distributionNumber}</td>
                  <td className="px-2 py-2">{row.distributionDate}</td>
                  <td className="px-2 py-2">{row.location}</td>
                  <td className="px-2 py-2">{row.beneficiaryCount ?? 0}</td>
                  <td className="px-2 py-2">{row.householdCount ?? 0}</td>
                  <td className="px-2 py-2">{formatEmpty(row.conductedBy)}</td>
                  <td className="px-2 py-2">{row.incidentReference ?? ""}</td>
                  <td className="px-2 py-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadPdfMutation.isPending}
                      onClick={async () => {
                        try {
                          const file = await downloadPdfMutation.mutateAsync({ id: row.id });
                          downloadBase64File(file.data, file.filename || `${row.distributionNumber}.pdf`, file.mimeType);
                          toast.success("PDF downloaded.");
                        } catch {
                          // handled by mutation
                        }
                      }}
                    >
                      {downloadPdfMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating…
                        </>
                      ) : (
                        "Download PDF"
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>New distribution</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Label>Waybill</Label>
            <Select value={waybillId} onValueChange={setWaybillId}>
              <SelectTrigger><SelectValue placeholder="Select dispatched waybill" /></SelectTrigger>
              <SelectContent>{(waybills.data ?? []).map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.wbNumber}</SelectItem>)}</SelectContent>
            </Select>
            <Label>Distribution date <DateHint /></Label>
            <Input type="date" value={distributionDate} onChange={(e) => setDistributionDate(e.target.value)} />
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            <Label>Location type</Label>
            <Select value={locationType} onValueChange={setLocationType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IDP camp">IDP camp</SelectItem>
                <SelectItem value="village">village</SelectItem>
                <SelectItem value="community center">community center</SelectItem>
                <SelectItem value="other">other</SelectItem>
              </SelectContent>
            </Select>
            <Label>Incident reference</Label>
            <Input value={incident} onChange={(e) => setIncident(e.target.value)} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Households</Label><Input aria-label="Households" placeholder="Households" value={householdCount} onChange={(e) => setHouseholdCount(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Individuals</Label><Input aria-label="Individuals" placeholder="Individuals" value={beneficiaryCount} onChange={(e) => setBeneficiaryCount(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Male</Label><Input aria-label="Male" placeholder="Male" value={maleCount} onChange={(e) => setMaleCount(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Female</Label><Input aria-label="Female" placeholder="Female" value={femaleCount} onChange={(e) => setFemaleCount(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Children</Label><Input aria-label="Children" placeholder="Children" value={childrenCount} onChange={(e) => setChildrenCount(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Elderly</Label><Input aria-label="Elderly" placeholder="Elderly" value={elderlyCount} onChange={(e) => setElderlyCount(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">PWD</Label><Input aria-label="PWD" placeholder="PWD" value={pwdCount} onChange={(e) => setPwdCount(e.target.value)} /></div>
            </div>
            <Label>Observers</Label>
            <Input value={observers} onChange={(e) => setObservers(e.target.value)} />
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Label>Challenges</Label>
            <Textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    waybillId: waybillId ? Number(waybillId) : undefined,
                    incidentReference: incident || undefined,
                    distributionDate,
                    location,
                    locationType,
                    beneficiaryCount: beneficiaryCount ? Number(beneficiaryCount) : undefined,
                    householdCount: householdCount ? Number(householdCount) : undefined,
                    maleCount: maleCount ? Number(maleCount) : undefined,
                    femaleCount: femaleCount ? Number(femaleCount) : undefined,
                    childrenCount: childrenCount ? Number(childrenCount) : undefined,
                    elderlyCount: elderlyCount ? Number(elderlyCount) : undefined,
                    pwdCount: pwdCount ? Number(pwdCount) : undefined,
                    observers: observers || undefined,
                    notes: notes || undefined,
                    challenges: challenges || undefined,
                    itemsDistributed: [],
                    teamMembers: [],
                    photos: [],
                  })
                }
              >
                Submit
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
