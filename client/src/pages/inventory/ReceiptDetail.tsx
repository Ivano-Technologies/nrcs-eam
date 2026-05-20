import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import { GrnLineItemsTable, type GrnLineItem } from "@/components/wms/GrnLineItemsTable";
import { SignatureBlock, type SignatureValue } from "@/components/wms/SignatureBlock";
import { CtnInlineCreator } from "@/components/wms/CtnInlineCreator";
import { applyGrnSuggestion, looksLikeGrnNumber } from "@/lib/grnNumberSuggest";
import { enqueueGrnOperation } from "@/lib/offlineSyncQueue";
import { Loader2 } from "lucide-react";

const emptyLine = (): GrnLineItem => ({
  consignmentNumber: "",
  description: "",
  ctnId: "",
  nbOfUnits: "",
  unitType: "pieces",
  weightKg: "",
  receivedInGoodCondition: true,
  claimNotes: "",
});

const emptySignature = (): SignatureValue => ({
  mode: "typed",
  name: "",
  date: "",
  functionTitle: "",
  signatureText: "",
});

const COPY_TYPES = ["white", "green", "blue", "yellow"] as const;

export default function ReceiptDetail() {
  const [, setLocation] = useLocation();
  const [matchNew] = useRoute("/app/inventory/receipts/new");
  const [, params] = useRoute("/app/inventory/receipts/:id");
  const documentId = !matchNew && params?.id ? Number(params.id) : null;

  const [form, setForm] = useState({
    grnNumber: "",
    countryCode: "NG",
    delegationLocationId: "",
    receivedFrom: "",
    dateOfArrival: "",
    documentWellReceived: true,
    incompleteDocumentsNotes: "",
    meansOfTransport: "road",
    awbNumber: "",
    waybillCmrNumber: "",
    blNumber: "",
    flightNumber: "",
    registrationNumber: "",
    vesselName: "",
    comments: "",
  });
  const [lines, setLines] = useState<GrnLineItem[]>([emptyLine()]);
  const [deliveredBy, setDeliveredBy] = useState<SignatureValue>(emptySignature());
  const [receivedBy, setReceivedBy] = useState<SignatureValue>(emptySignature());
  const [dirty, setDirty] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(documentId);
  const [inlineCreatorOpen, setInlineCreatorOpen] = useState(false);
  const [inlineCreatorLineIndex, setInlineCreatorLineIndex] = useState<number | null>(null);

  const { data: sites } = trpc.sites.list.useQuery();
  const warehouses = useMemo(() => (sites ?? []).filter((s) => s.facilityType === "warehouse"), [sites]);
  const ctnList = trpc.wms.ctn.list.useQuery({ limit: 200, offset: 0 });
  const suggestNumber = trpc.inventoryV2.receipts.suggestNumber.useQuery(
    { facilityId: form.delegationLocationId ? Number(form.delegationLocationId) : undefined },
    { enabled: savedId == null }
  );
  const receiptQuery = trpc.inventoryV2.receipts.get.useQuery(
    { documentId: documentId ?? 0 },
    { enabled: documentId != null }
  );

  const createDraft = trpc.inventoryV2.receipts.createDraft.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const updateDraft = trpc.inventoryV2.receipts.updateDraft.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const approveMutation = trpc.inventoryV2.receipts.approve.useMutation({
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    const doc = receiptQuery.data;
    if (!doc) return;
    const td = (doc.transportDetails ?? {}) as Record<string, unknown>;
    setForm({
      grnNumber: doc.documentNumber,
      countryCode: String(td.countryCode ?? "NG"),
      delegationLocationId: String(doc.toWarehouseId ?? ""),
      receivedFrom: String(doc.referenceDocument ?? ""),
      dateOfArrival: String(td.dateOfArrival ?? "").slice(0, 10),
      documentWellReceived: td.documentWellReceived !== false,
      incompleteDocumentsNotes: String(td.incompleteDocumentsNotes ?? ""),
      meansOfTransport: String(td.meansOfTransport ?? "road"),
      awbNumber: String(td.awbNumber ?? ""),
      waybillCmrNumber: String(td.waybillCmrNumber ?? ""),
      blNumber: String(td.blNumber ?? ""),
      flightNumber: String(td.flightNumber ?? ""),
      registrationNumber: String(td.registrationNumber ?? ""),
      vesselName: String(td.vesselName ?? ""),
      comments: String(td.comments ?? doc.notes ?? ""),
    });
    const parsed = Array.isArray(doc.items) ? doc.items : [];
    setLines(
      parsed.length
        ? parsed.map((x: any) => ({
            consignmentNumber: String(x.consignmentNumber ?? ""),
            description: String(x.description ?? ""),
            ctnId: String(x.ctnId ?? ""),
            nbOfUnits: String(x.quantity ?? x.nbOfUnits ?? ""),
            unitType: String(x.unitType ?? "pieces"),
            weightKg: String(x.weightKg ?? ""),
            receivedInGoodCondition: x.receivedInGoodCondition !== false,
            claimNotes: String(x.claimNotes ?? ""),
          }))
        : [emptyLine()]
    );
    setDeliveredBy({
      mode: "typed",
      name: String(td.deliveredByName ?? ""),
      date: String(td.deliveredByDate ?? ""),
      functionTitle: String(td.deliveredByFunction ?? ""),
      signatureText: String(td.deliveredBySignature ?? ""),
    });
    setReceivedBy({
      mode: "typed",
      name: String(td.receivedByName ?? ""),
      date: String(td.receivedByDate ?? ""),
      functionTitle: String(td.receivedByFunction ?? ""),
      signatureText: String(td.receivedBySignature ?? ""),
    });
    setSavedId(doc.id);
    setDirty(false);
  }, [receiptQuery.data]);

  useEffect(() => {
    if (!suggestNumber.data) return;
    setForm((prev) => ({
      ...prev,
      grnNumber: applyGrnSuggestion(prev.grnNumber, suggestNumber.data!.suggested),
    }));
  }, [suggestNumber.data]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const ctnOptions = useMemo(
    () =>
      (ctnList.data?.items ?? []).map((c) => ({
        id: c.id,
        label: `${c.ctnCode} — ${c.itemCode} ${c.itemName}`,
      })),
    [ctnList.data?.items]
  );

  const isFinalizable = useMemo(() => {
    if (!form.grnNumber.trim()) return false;
    if (!form.delegationLocationId) return false;
    if (!form.receivedFrom.trim()) return false;
    if (!form.dateOfArrival) return false;
    if (new Date(form.dateOfArrival).getTime() > Date.now()) return false;
    if (!deliveredBy.name.trim() || !receivedBy.name.trim()) return false;
    if (lines.some((l) => !l.ctnId || Number(l.nbOfUnits) <= 0)) return false;
    return true;
  }, [deliveredBy.name, form.dateOfArrival, form.delegationLocationId, form.grnNumber, form.receivedFrom, lines, receivedBy.name]);
  const isFinalized = receiptQuery.data?.status === "completed";

  const payload = useMemo(
    () => ({
      ...form,
      delegationLocationId: Number(form.delegationLocationId),
      items: lines.map((l) => ({
        catalogueId:
          (ctnList.data?.items.find((c) => String(c.id) === l.ctnId)?.itemId as number | undefined) ??
          Number(ctnList.data?.items[0]?.itemId ?? 1),
        ctnId: Number(l.ctnId),
        quantity: Number(l.nbOfUnits || 0),
        consignmentNumber: l.consignmentNumber || undefined,
        description: l.description || undefined,
        unitType: l.unitType || undefined,
        weightKg: l.weightKg ? Number(l.weightKg) : undefined,
        receivedInGoodCondition: l.receivedInGoodCondition,
        claimNotes: l.claimNotes || undefined,
        notes: l.claimNotes || undefined,
      })),
      deliveredByName: deliveredBy.name,
      deliveredByDate: deliveredBy.date,
      deliveredByFunction: deliveredBy.functionTitle,
      deliveredBySignature: deliveredBy.signatureText,
      receivedByName: receivedBy.name,
      receivedByDate: receivedBy.date,
      receivedByFunction: receivedBy.functionTitle,
      receivedBySignature: receivedBy.signatureText,
    }),
    [ctnList.data?.items, deliveredBy, form, lines, receivedBy]
  );

  const saveDraft = async () => {
    if (!navigator.onLine) {
      if (savedId == null) {
        enqueueGrnOperation({ kind: "createDraft", payload: payload as unknown });
        toast.info("GRN draft saved offline — will sync when you are back online.");
      } else {
        enqueueGrnOperation({
          kind: "updateDraft",
          documentId: savedId,
          payload: payload as unknown,
        });
        toast.info("GRN draft saved offline — will sync when you are back online.");
      }
      setDirty(false);
      return;
    }
    if (savedId == null) {
      const created = await createDraft.mutateAsync(payload as any);
      setSavedId(created.id);
      setLocation(`/app/inventory/receipts/${created.id}`);
      toast.success("GRN draft saved.");
    } else {
      await updateDraft.mutateAsync({ documentId: savedId, payload: payload as any });
      toast.success("GRN draft updated.");
    }
    setDirty(false);
  };

  const draftPending = createDraft.isPending || updateDraft.isPending;
  const finalizePending = draftPending || approveMutation.isPending;

  const finalize = async () => {
    if (!isFinalizable) {
      toast.error("Please complete all required fields before finalize.");
      return;
    }
    if (savedId == null) {
      const created = await createDraft.mutateAsync(payload as any);
      setSavedId(created.id);
    } else {
      await updateDraft.mutateAsync({ documentId: savedId, payload: payload as any });
    }
    const id = savedId ?? (await createDraft.mutateAsync(payload as any)).id;
    await approveMutation.mutateAsync({ documentId: id });
    toast.success("GRN finalized.");
    setDirty(false);
    void receiptQuery.refetch();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">{savedId ? "GRN Detail" : "New GRN"}</h1>
        <InventorySecondaryNav />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Goods Received Note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="grn-number">GRN number</Label>
                <Input id="grn-number" value={form.grnNumber} onChange={(e) => { setForm((p) => ({ ...p, grnNumber: e.target.value })); setDirty(true); }} />
                {!looksLikeGrnNumber(form.grnNumber) ? (
                  <p className="text-xs text-amber-600">Expected format: NRCS-{'{FACILITY_CODE}'}-{'{YYYY}'}-{'{SEQ}'}</p>
                ) : null}
                {suggestNumber.data ? (
                  <p className="text-xs text-muted-foreground">Suggested: {suggestNumber.data.suggested}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label>Country code</Label>
                <Input value={form.countryCode} onChange={(e) => { setForm((p) => ({ ...p, countryCode: e.target.value })); setDirty(true); }} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="grn-delegation-location">Delegation/Consignee Location</Label>
                <Select value={form.delegationLocationId || undefined} onValueChange={(v) => { setForm((p) => ({ ...p, delegationLocationId: v })); setDirty(true); }}>
                  <SelectTrigger id="grn-delegation-location" className="h-9"><SelectValue placeholder="Select facility" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="grn-received-from">Received from</Label>
                <Input id="grn-received-from" value={form.receivedFrom} onChange={(e) => { setForm((p) => ({ ...p, receivedFrom: e.target.value })); setDirty(true); }} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="grn-date-of-arrival">Date of arrival</Label>
                <Input id="grn-date-of-arrival" type="date" value={form.dateOfArrival} onChange={(e) => { setForm((p) => ({ ...p, dateOfArrival: e.target.value })); setDirty(true); }} />
              </div>
              <div className="space-y-1">
                <Label>Means of transport</Label>
                <Select value={form.meansOfTransport} onValueChange={(v) => { setForm((p) => ({ ...p, meansOfTransport: v })); setDirty(true); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="road">Road</SelectItem>
                    <SelectItem value="rail">Rail</SelectItem>
                    <SelectItem value="air">Air</SelectItem>
                    <SelectItem value="sea">Sea</SelectItem>
                    <SelectItem value="handcarried">Hand-carried</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox checked={form.documentWellReceived} onCheckedChange={(v) => { setForm((p) => ({ ...p, documentWellReceived: !!v })); setDirty(true); }} />
              <span className="text-sm">Document well received</span>
            </div>
            {!form.documentWellReceived ? (
              <div className="space-y-1">
                <Label>Incomplete documents notes</Label>
                <Textarea value={form.incompleteDocumentsNotes} onChange={(e) => { setForm((p) => ({ ...p, incompleteDocumentsNotes: e.target.value })); setDirty(true); }} />
              </div>
            ) : null}

            {form.meansOfTransport === "rail" ? (
              <div className="space-y-1">
                <Label>Waybill/CMR number</Label>
                <Input value={form.waybillCmrNumber} onChange={(e) => { setForm((p) => ({ ...p, waybillCmrNumber: e.target.value })); setDirty(true); }} />
              </div>
            ) : null}
            {form.meansOfTransport === "air" ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1"><Label>AWB number</Label><Input value={form.awbNumber} onChange={(e) => { setForm((p) => ({ ...p, awbNumber: e.target.value })); setDirty(true); }} /></div>
                <div className="space-y-1"><Label>Flight number</Label><Input value={form.flightNumber} onChange={(e) => { setForm((p) => ({ ...p, flightNumber: e.target.value })); setDirty(true); }} /></div>
                <div className="space-y-1"><Label>Registration number</Label><Input value={form.registrationNumber} onChange={(e) => { setForm((p) => ({ ...p, registrationNumber: e.target.value })); setDirty(true); }} /></div>
              </div>
            ) : null}
            {form.meansOfTransport === "sea" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1"><Label>B/L number</Label><Input value={form.blNumber} onChange={(e) => { setForm((p) => ({ ...p, blNumber: e.target.value })); setDirty(true); }} /></div>
                <div className="space-y-1"><Label>Vessel name</Label><Input value={form.vesselName} onChange={(e) => { setForm((p) => ({ ...p, vesselName: e.target.value })); setDirty(true); }} /></div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Line items</Label>
              <GrnLineItemsTable
                lines={lines}
                ctnOptions={ctnOptions}
                onChange={(next) => { setLines(next); setDirty(true); }}
                onAddLine={() => { setLines((prev) => [...prev, emptyLine()]); setDirty(true); }}
                onRemoveLine={(index) => { setLines((prev) => prev.filter((_, i) => i !== index)); setDirty(true); }}
                onCreateCtnForLine={(index) => {
                  setInlineCreatorLineIndex(index);
                  setInlineCreatorOpen(true);
                }}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <SignatureBlock title="Delivered by" value={deliveredBy} onChange={(next) => { setDeliveredBy(next); setDirty(true); }} />
              <SignatureBlock title="Received by" value={receivedBy} onChange={(next) => { setReceivedBy(next); setDirty(true); }} />
            </div>

            <div className="space-y-1">
              <Label>Comments</Label>
              <Textarea value={form.comments} onChange={(e) => { setForm((p) => ({ ...p, comments: e.target.value })); setDirty(true); }} />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setLocation("/app/inventory/receipts")}>Cancel</Button>
              <Button variant="outline" disabled={draftPending} onClick={() => void saveDraft()}>
                {draftPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save as Draft"
                )}
              </Button>
              <Button onClick={() => void finalize()} disabled={!isFinalizable || finalizePending}>
                {finalizePending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finalizing…
                  </>
                ) : (
                  "Finalize"
                )}
              </Button>
              {savedId && isFinalized ? (
                <>
                  <Button variant="outline" onClick={() => setLocation(`/app/inventory/receipts/${savedId}/print/white`)}>
                    White copy
                  </Button>
                  <Button variant="outline" onClick={() => setLocation(`/app/inventory/receipts/${savedId}/print/green`)}>
                    Green copy
                  </Button>
                  <Button variant="outline" onClick={() => setLocation(`/app/inventory/receipts/${savedId}/print/blue`)}>
                    Blue copy
                  </Button>
                  <Button variant="outline" onClick={() => setLocation(`/app/inventory/receipts/${savedId}/print/yellow`)}>
                    Yellow copy
                  </Button>
                </>
              ) : null}
            </div>
            {savedId && isFinalized ? (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {COPY_TYPES.map((copy) => {
                  const timestamp = (receiptQuery.data?.copiesPrinted as Record<string, string | null> | undefined)?.[copy];
                  return (
                    <div key={copy} className="rounded border px-2 py-1">
                      {timestamp ? `✔ ${copy}: ${new Date(timestamp).toLocaleString()}` : `○ ${copy}: unprinted`}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="font-medium">GRN:</span> {form.grnNumber || "—"}</div>
            <div><span className="font-medium">Location:</span> {warehouses.find((w) => String(w.id) === form.delegationLocationId)?.name ?? "—"}</div>
            <div><span className="font-medium">Received from:</span> {form.receivedFrom || "—"}</div>
            <div><span className="font-medium">Arrival:</span> {form.dateOfArrival || "—"}</div>
            <div><span className="font-medium">Lines:</span> {lines.length}</div>
            <div><span className="font-medium">Status:</span> {savedId ? "draft/finalizable" : "new draft"}</div>
          </CardContent>
        </Card>
      </div>

      <CtnInlineCreator
        open={inlineCreatorOpen}
        onOpenChange={setInlineCreatorOpen}
        defaultReceivedDate={form.dateOfArrival}
        defaultQuantity={inlineCreatorLineIndex != null ? lines[inlineCreatorLineIndex]?.nbOfUnits : ""}
        onCreated={(ctn) => {
          if (inlineCreatorLineIndex == null) return;
          setLines((prev) => prev.map((line, i) => (i === inlineCreatorLineIndex ? { ...line, ctnId: String(ctn.id) } : line)));
          setDirty(true);
        }}
      />
    </div>
  );
}

