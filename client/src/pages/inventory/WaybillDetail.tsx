import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignatureBlock, type SignatureValue } from "@/components/wms/SignatureBlock";
import { CtnInlineCreator } from "@/components/wms/CtnInlineCreator";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import { formatNaira } from "@/lib/format";
import { toast } from "sonner";

type WaybillSource = {
  ctnId: string;
  quantity: string;
  overrideReason: string;
  currentBalance?: number;
  expired?: boolean;
};

type WaybillLine = {
  itemId: string;
  itemDescription: string;
  nbOfUnits: string;
  unitType: string;
  remarks: string;
  ctnSources: WaybillSource[];
};

const emptySignature = (): SignatureValue => ({
  mode: "typed",
  name: "",
  date: "",
  functionTitle: "",
  signatureText: "",
});

const emptyLine = (): WaybillLine => ({
  itemId: "",
  itemDescription: "",
  nbOfUnits: "",
  unitType: "pieces",
  remarks: "",
  ctnSources: [{ ctnId: "", quantity: "", overrideReason: "" }],
});

export default function WaybillDetail() {
  const [, setLocation] = useLocation();
  const [matchNew] = useRoute("/app/inventory/issues/new");
  const [, params] = useRoute("/app/inventory/issues/:id");
  const waybillId = !matchNew && params?.id ? Number(params.id) : null;

  const [header, setHeader] = useState({
    wbNumber: "",
    date: new Date().toISOString().slice(0, 10),
    warehouseId: "",
    destinationType: "beneficiary",
    destinationBeneficiary: "",
    destinationLocation: "",
    requisitionId: "",
    meansOfTransport: "road",
    vehicle1: "",
    registration1: "",
    transportedByName: "",
    comments: "",
  });
  const [loadedBy, setLoadedBy] = useState<SignatureValue>(emptySignature());
  const [transportedBy, setTransportedBy] = useState<SignatureValue>(emptySignature());
  const [lines, setLines] = useState<WaybillLine[]>([emptyLine()]);
  const [inlineCreatorOpen, setInlineCreatorOpen] = useState(false);
  const [inlineSource, setInlineSource] = useState<{ lineIdx: number; sourceIdx: number } | null>(null);

  const { data: sites } = trpc.sites.list.useQuery();
  const { data: catalogue } = trpc.inventoryV2.catalogue.list.useQuery();
  const requisitions = trpc.inventoryV2.requisitions.list.useQuery({ status: "hq_approved" });
  const ctnList = trpc.wms.ctn.list.useQuery({
    limit: 200,
    offset: 0,
    search: undefined,
  });
  const suggestNumber = trpc.inventoryV2.waybills.generateNumber.useQuery(
    { warehouseId: Number(header.warehouseId || 0) },
    { enabled: !!header.warehouseId && waybillId == null }
  );
  const details = trpc.inventoryV2.waybills.get.useQuery({ id: waybillId ?? 0 }, { enabled: waybillId != null });

  const createMutation = trpc.inventoryV2.waybills.create.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.inventoryV2.waybills.update.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const dispatchMutation = trpc.inventoryV2.waybills.dispatch.useMutation({
    onSuccess: () => {
      toast.success("Waybill dispatched.");
      void details.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const warehouses = useMemo(() => (sites ?? []).filter((site) => site.facilityType === "warehouse"), [sites]);
  const ctnOptions = useMemo(() => ctnList.data?.items ?? [], [ctnList.data?.items]);

  useEffect(() => {
    if (!suggestNumber.data?.suggested || waybillId != null) return;
    setHeader((prev) => ({ ...prev, wbNumber: prev.wbNumber || suggestNumber.data!.suggested }));
  }, [suggestNumber.data, waybillId]);

  useEffect(() => {
    if (!details.data) return;
    const wb = details.data;
    setHeader({
      wbNumber: wb.wbNumber,
      date: wb.date,
      warehouseId: String(wb.warehouseId),
      destinationType: wb.destinationType,
      destinationBeneficiary: wb.destinationBeneficiary,
      destinationLocation: wb.destinationLocation ?? "",
      requisitionId: wb.requisitionId ? String(wb.requisitionId) : "",
      meansOfTransport: wb.meansOfTransport ?? "road",
      vehicle1: wb.vehicle1 ?? "",
      registration1: wb.registration1 ?? "",
      transportedByName: wb.transportedByName ?? "",
      comments: wb.comments ?? "",
    });
    setLoadedBy((prev) => ({
      ...prev,
      name: wb.loadedByName ?? "",
      date: wb.loadedByDate ?? "",
      functionTitle: wb.loadedByFunction ?? "",
    }));
    setTransportedBy((prev) => ({
      ...prev,
      name: wb.transportedByName ?? "",
      date: wb.transportedByDate ?? "",
      functionTitle: wb.transportedByFunction ?? "",
    }));
    setLines(
      wb.lines.map((line) => ({
        itemId: String(line.itemId),
        itemDescription: line.itemDescription,
        nbOfUnits: String(line.nbOfUnits),
        unitType: line.unitType,
        remarks: line.remarks ?? "",
        ctnSources: line.ctnSources.map((source) => ({
          ctnId: String(source.ctnId),
          quantity: String(source.quantity),
          overrideReason: source.overrideReason ?? "",
        })),
      }))
    );
  }, [details.data]);

  const lineTotalOk = (line: WaybillLine) => {
    const lineQty = Number(line.nbOfUnits || 0);
    const srcQty = line.ctnSources.reduce((sum, src) => sum + Number(src.quantity || 0), 0);
    return Math.abs(lineQty - srcQty) < 0.0001;
  };

  const hasExpiredSource = (source: WaybillSource) => {
    const row = ctnOptions.find((ctn) => String(ctn.id) === source.ctnId);
    if (!row?.expiryDate) return false;
    return new Date(row.expiryDate).getTime() < Date.now();
  };

  const payload = () => ({
    wbNumber: header.wbNumber,
    date: header.date,
    warehouseId: Number(header.warehouseId),
    destinationType: header.destinationType as "beneficiary" | "branch_store" | "other",
    destinationBeneficiary: header.destinationBeneficiary,
    destinationLocation: header.destinationLocation || undefined,
    requisitionId: header.requisitionId ? Number(header.requisitionId) : undefined,
    meansOfTransport: header.meansOfTransport as "road" | "rail" | "air" | "sea" | "handcarried",
    vehicle1: header.vehicle1 || undefined,
    registration1: header.registration1 || undefined,
    transportedByName: transportedBy.name || header.transportedByName,
    loadedByName: loadedBy.name || undefined,
    loadedByDate: loadedBy.date || undefined,
    loadedByFunction: loadedBy.functionTitle || undefined,
    transportedByDate: transportedBy.date || undefined,
    transportedByFunction: transportedBy.functionTitle || undefined,
    comments: header.comments || undefined,
    lines: lines.map((line) => ({
      itemId: Number(line.itemId),
      itemDescription: line.itemDescription,
      nbOfUnits: Number(line.nbOfUnits),
      unitType: line.unitType,
      remarks: line.remarks || undefined,
      ctnSources: line.ctnSources.map((source) => ({
        ctnId: Number(source.ctnId),
        quantity: Number(source.quantity),
        overrideReason: source.overrideReason || undefined,
      })),
    })),
  });

  const saveDraft = async () => {
    if (!header.warehouseId || !header.destinationBeneficiary) {
      toast.error("Warehouse and destination are required.");
      return;
    }
    if (waybillId == null) {
      const created = await createMutation.mutateAsync(payload());
      setLocation(`/app/inventory/issues/${created.id}`);
      toast.success("Waybill draft saved.");
      return;
    }
    await updateMutation.mutateAsync({ id: waybillId, payload: payload() });
    toast.success("Waybill draft updated.");
  };

  const dispatch = async () => {
    const lineIssues = lines.some((line) => !lineTotalOk(line) || line.ctnSources.some((src) => !src.ctnId || Number(src.quantity) <= 0));
    if (lineIssues) {
      toast.error("Each line must have CTN sources summing exactly to line quantity.");
      return;
    }
    await saveDraft();
    const id = waybillId ?? details.data?.id;
    if (!id) return;
    await dispatchMutation.mutateAsync({ id });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">{waybillId ? "Waybill Detail" : "New Waybill"}</h1>
        <InventorySecondaryNav />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Waybill / Delivery Note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>WB number</Label>
              <Input value={header.wbNumber} onChange={(e) => setHeader((p) => ({ ...p, wbNumber: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={header.date} onChange={(e) => setHeader((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Source warehouse</Label>
              <Select value={header.warehouseId || undefined} onValueChange={(v) => setHeader((p) => ({ ...p, warehouseId: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Destination type</Label>
              <Select value={header.destinationType} onValueChange={(v) => setHeader((p) => ({ ...p, destinationType: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beneficiary">Beneficiary</SelectItem>
                  <SelectItem value="branch_store">Branch store</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Destination name</Label>
              <Input value={header.destinationBeneficiary} onChange={(e) => setHeader((p) => ({ ...p, destinationBeneficiary: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Destination location</Label>
              <Input value={header.destinationLocation} onChange={(e) => setHeader((p) => ({ ...p, destinationLocation: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Link requisition (optional)</Label>
              <Select value={header.requisitionId || "none"} onValueChange={(v) => setHeader((p) => ({ ...p, requisitionId: v === "none" ? "" : v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No requisition</SelectItem>
                  {(requisitions.data ?? []).map((req) => (
                    <SelectItem key={req.id} value={String(req.id)}>
                      {req.lrNumber ?? req.reqNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Means of transport</Label>
              <Select value={header.meansOfTransport} onValueChange={(v) => setHeader((p) => ({ ...p, meansOfTransport: v }))}>
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button variant="outline" onClick={() => setLines((prev) => [...prev, emptyLine()])}>Add line</Button>
            </div>
            {lines.map((line, lineIdx) => (
              <Card key={lineIdx} className="border-dashed">
                <CardContent className="space-y-3 pt-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Item</Label>
                      <Select
                        value={line.itemId || undefined}
                        onValueChange={(value) =>
                          setLines((prev) =>
                            prev.map((row, idx) =>
                              idx === lineIdx
                                ? {
                                    ...row,
                                    itemId: value,
                                    itemDescription: catalogue?.find((cat) => String(cat.id) === value)?.name ?? row.itemDescription,
                                  }
                                : row
                            )
                          )
                        }
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>
                          {(catalogue ?? []).map((item) => (
                            <SelectItem key={item.id} value={String(item.id)}>
                              {item.itemCode} - {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Description</Label>
                      <Input value={line.itemDescription} onChange={(e) => setLines((prev) => prev.map((row, idx) => (idx === lineIdx ? { ...row, itemDescription: e.target.value } : row)))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Total quantity</Label>
                      <Input value={line.nbOfUnits} onChange={(e) => setLines((prev) => prev.map((row, idx) => (idx === lineIdx ? { ...row, nbOfUnits: e.target.value } : row)))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Unit</Label>
                      <Input value={line.unitType} onChange={(e) => setLines((prev) => prev.map((row, idx) => (idx === lineIdx ? { ...row, unitType: e.target.value } : row)))} />
                    </div>
                  </div>

                  <div className="space-y-2 rounded border p-2">
                    <div className="text-sm font-medium">CTN sources</div>
                    {line.ctnSources.map((source, sourceIdx) => {
                      const ctn = ctnOptions.find((entry) => String(entry.id) === source.ctnId);
                      const expired = hasExpiredSource(source);
                      return (
                        <div key={sourceIdx} className="grid gap-2 md:grid-cols-6">
                          <Select
                            value={source.ctnId || undefined}
                            onValueChange={(value) =>
                              setLines((prev) =>
                                prev.map((row, idx) =>
                                  idx === lineIdx
                                    ? {
                                        ...row,
                                        ctnSources: row.ctnSources.map((s, sIdx) => (sIdx === sourceIdx ? { ...s, ctnId: value } : s)),
                                      }
                                    : row
                                )
                              )
                            }
                          >
                            <SelectTrigger className="h-9 md:col-span-2"><SelectValue placeholder="CTN" /></SelectTrigger>
                            <SelectContent>
                              {ctnOptions
                                .filter((entry) => !line.itemId || String(entry.itemId) === line.itemId)
                                .map((entry) => (
                                  <SelectItem key={entry.id} value={String(entry.id)}>
                                    {entry.ctnCode} ({entry.currentBalance})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Input
                            className="h-9"
                            placeholder="Qty"
                            value={source.quantity}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((row, idx) =>
                                  idx === lineIdx
                                    ? {
                                        ...row,
                                        ctnSources: row.ctnSources.map((s, sIdx) => (sIdx === sourceIdx ? { ...s, quantity: e.target.value } : s)),
                                      }
                                    : row
                                )
                              )
                            }
                          />
                          <div className="flex h-9 items-center rounded border px-2 text-xs">
                            Balance: {ctn?.currentBalance ?? "—"}
                          </div>
                          <div className="flex h-9 items-center">
                            {expired ? <Badge variant="destructive">expired</Badge> : <Badge variant="secondary">valid</Badge>}
                          </div>
                          <Button
                            variant="outline"
                            className="h-9"
                            onClick={() => {
                              setInlineSource({ lineIdx, sourceIdx });
                              setInlineCreatorOpen(true);
                            }}
                          >
                            Create CTN
                          </Button>
                          {expired ? (
                            <Textarea
                              className="md:col-span-6"
                              placeholder="Manager override reason"
                              value={source.overrideReason}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((row, idx) =>
                                    idx === lineIdx
                                      ? {
                                          ...row,
                                          ctnSources: row.ctnSources.map((s, sIdx) =>
                                            sIdx === sourceIdx ? { ...s, overrideReason: e.target.value } : s
                                          ),
                                        }
                                      : row
                                  )
                                )
                              }
                            />
                          ) : null}
                        </div>
                      );
                    })}
                    <Button
                      variant="outline"
                      onClick={() =>
                        setLines((prev) =>
                          prev.map((row, idx) =>
                            idx === lineIdx ? { ...row, ctnSources: [...row.ctnSources, { ctnId: "", quantity: "", overrideReason: "" }] } : row
                          )
                        )
                      }
                    >
                      Add another CTN
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      Line total check: {lineTotalOk(line) ? "OK" : "CTN source quantities must equal line quantity"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {lines.some((line) => line.ctnSources.some((source) => hasExpiredSource(source))) ? (
            <Card className="border-amber-500">
              <CardHeader>
                <CardTitle className="text-base text-amber-700">Manager override required for expired stock</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>This waybill includes at least one expired CTN source. Dispatch requires manager approval and reason.</p>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <SignatureBlock title="Loaded by" value={loadedBy} onChange={setLoadedBy} />
            <SignatureBlock title="Transported by" value={transportedBy} onChange={setTransportedBy} />
          </div>
          <div className="space-y-1">
            <Label>Comments</Label>
            <Textarea value={header.comments} onChange={(e) => setHeader((p) => ({ ...p, comments: e.target.value }))} />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setLocation("/app/inventory/issues")}>Cancel</Button>
            <Button variant="outline" onClick={() => void saveDraft()}>Save as Draft</Button>
            <Button onClick={() => void dispatch()}>Dispatch</Button>
            {waybillId && details.data?.status === "dispatched" ? (
              <>
                <Button variant="outline" onClick={() => setLocation(`/app/inventory/issues/${waybillId}/print/white`)}>White copy</Button>
                <Button variant="outline" onClick={() => setLocation(`/app/inventory/issues/${waybillId}/print/green`)}>Green copy</Button>
                <Button variant="outline" onClick={() => setLocation(`/app/inventory/issues/${waybillId}/print/blue`)}>Blue copy</Button>
                <Button variant="outline" onClick={() => setLocation(`/app/inventory/issues/${waybillId}/print/yellow`)}>Yellow copy</Button>
              </>
            ) : null}
          </div>

          <div className="text-sm text-muted-foreground">Estimated dispatch value preview: {formatNaira(0)}</div>
        </CardContent>
      </Card>

      <CtnInlineCreator
        open={inlineCreatorOpen}
        onOpenChange={setInlineCreatorOpen}
        defaultReceivedDate={header.date}
        onCreated={(ctn) => {
          if (!inlineSource) return;
          setLines((prev) =>
            prev.map((line, idx) =>
              idx === inlineSource.lineIdx
                ? {
                    ...line,
                    ctnSources: line.ctnSources.map((source, sourceIdx) =>
                      sourceIdx === inlineSource.sourceIdx ? { ...source, ctnId: String(ctn.id) } : source
                    ),
                  }
                : line
            )
          );
        }}
      />
    </div>
  );
}
