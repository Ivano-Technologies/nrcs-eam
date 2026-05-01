import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ViewToggle, type ViewMode } from "@/components/ViewToggle";
import { toast } from "sonner";

function downloadBase64File(data: string, filename: string, mimeType: string) {
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Distributions({ embedInShell = false }: { embedInShell?: boolean } = {}) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("viewMode_inventory_distributions") as ViewMode) || "table");
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

  useEffect(() => localStorage.setItem("viewMode_inventory_distributions", viewMode), [viewMode]);

  const waybills = trpc.inventoryV2.waybills.list.useQuery({ status: "dispatched" });
  const list = trpc.inventoryV2.distributions.list.useQuery({ incidentReference: incident || undefined, location: location || undefined });
  const createMutation = trpc.inventoryV2.distributions.create.useMutation({
    onSuccess: () => {
      toast.success("Distribution created");
      setOpen(false);
      void list.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const downloadPdfMutation = trpc.inventoryV2.distributions.downloadPdf.useMutation({
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {!embedInShell ? (
        <>
          <h1 className="text-3xl font-bold">Distributions</h1>
          <InventorySecondaryNav />
        </>
      ) : null}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-4">
          <Input placeholder="Incident" className="w-[220px]" value={incident} onChange={(e) => setIncident(e.target.value)} />
          <Input placeholder="Location" className="w-[220px]" value={location} onChange={(e) => setLocation(e.target.value)} />
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <Button data-testid="new-dist-btn" className="ml-auto" onClick={() => setOpen(true)}>New Distribution</Button>
        </CardContent>
      </Card>
      {viewMode === "card" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(list.data ?? []).map((row) => (
            <Card key={row.id} data-testid={`dist-row-${row.distributionNumber}`}>
              <CardContent className="space-y-2 p-4">
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
                <th className="px-2 py-2 text-left">Dist No</th>
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Location</th>
                <th className="px-2 py-2 text-left">Beneficiaries</th>
                <th className="px-2 py-2 text-left">Households</th>
                <th className="px-2 py-2 text-left">Conducted By</th>
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
                  <td className="px-2 py-2">{row.conductedBy ?? "—"}</td>
                  <td className="px-2 py-2">{row.incidentReference ?? "—"}</td>
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
                      {downloadPdfMutation.isPending ? "Generating..." : "Download PDF"}
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
          <DialogHeader><DialogTitle>New Distribution</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Label>Waybill</Label>
            <Select value={waybillId} onValueChange={setWaybillId}>
              <SelectTrigger><SelectValue placeholder="Select dispatched waybill" /></SelectTrigger>
              <SelectContent>{(waybills.data ?? []).map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.wbNumber}</SelectItem>)}</SelectContent>
            </Select>
            <Label>Distribution Date</Label>
            <Input type="date" value={distributionDate} onChange={(e) => setDistributionDate(e.target.value)} />
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            <Label>Location Type</Label>
            <Select value={locationType} onValueChange={setLocationType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IDP camp">IDP camp</SelectItem>
                <SelectItem value="village">village</SelectItem>
                <SelectItem value="community center">community center</SelectItem>
                <SelectItem value="other">other</SelectItem>
              </SelectContent>
            </Select>
            <Label>Incident Reference</Label>
            <Input value={incident} onChange={(e) => setIncident(e.target.value)} />
            <div className="grid grid-cols-4 gap-2">
              <Input placeholder="Households" value={householdCount} onChange={(e) => setHouseholdCount(e.target.value)} />
              <Input placeholder="Individuals" value={beneficiaryCount} onChange={(e) => setBeneficiaryCount(e.target.value)} />
              <Input placeholder="Male" value={maleCount} onChange={(e) => setMaleCount(e.target.value)} />
              <Input placeholder="Female" value={femaleCount} onChange={(e) => setFemaleCount(e.target.value)} />
              <Input placeholder="Children" value={childrenCount} onChange={(e) => setChildrenCount(e.target.value)} />
              <Input placeholder="Elderly" value={elderlyCount} onChange={(e) => setElderlyCount(e.target.value)} />
              <Input placeholder="PWD" value={pwdCount} onChange={(e) => setPwdCount(e.target.value)} />
            </div>
            <Label>Observers</Label>
            <Input value={observers} onChange={(e) => setObservers(e.target.value)} />
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Label>Challenges</Label>
            <Textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} />
            <div className="flex justify-end gap-2">
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
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
