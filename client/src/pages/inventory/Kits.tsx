import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { toast } from "sonner";

type ComponentLine = { catalogueId: string; quantity: string };

export default function Kits() {
  const { isManagerOrAdmin, isStaffOrAbove } = usePermissions();
  const [open, setOpen] = useState(false);
  const [kitCode, setKitCode] = useState("");
  const [kitName, setKitName] = useState("");
  const [kitType, setKitType] = useState("custom");
  const [components, setComponents] = useState<ComponentLine[]>([{ catalogueId: "", quantity: "" }]);
  const [selectedKitId, setSelectedKitId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");

  const kits = trpc.inventoryV2.kits.list.useQuery();
  const { data: catalogue } = trpc.inventoryV2.catalogue.list.useQuery();
  const { data: facilities } = trpc.sites.list.useQuery();
  const warehouses = useMemo(() => (facilities ?? []).filter((f) => f.facilityType === "warehouse"), [facilities]);

  const createMutation = trpc.inventoryV2.kits.create.useMutation({
    onSuccess: () => {
      toast.success("Kit created");
      setOpen(false);
      void kits.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const assembleMutation = trpc.inventoryV2.kits.assemble.useMutation({ onSuccess: () => toast.success("Assembled"), onError: (e) => toast.error(e.message) });
  const disassembleMutation = trpc.inventoryV2.kits.disassemble.useMutation({ onSuccess: () => toast.success("Disassembled"), onError: (e) => toast.error(e.message) });

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Kits</h1>
      <InventorySecondaryNav />
      <Tabs defaultValue="catalogue">
        <TabsList>
          <TabsTrigger value="catalogue">Kit Catalogue</TabsTrigger>
          <TabsTrigger value="operations">Kit Operations</TabsTrigger>
        </TabsList>
        <TabsContent value="catalogue" className="space-y-3">
          {isManagerOrAdmin ? <Button onClick={() => setOpen(true)}>Add Kit</Button> : null}
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left">Kit Code</th>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Type</th>
                  <th className="px-2 py-2 text-left">Components</th>
                </tr>
              </thead>
              <tbody>
                {(kits.data ?? []).map((k) => (
                  <tr key={k.id} data-testid={`kit-row-${k.kitCode}`} className="border-b">
                    <td className="px-2 py-2 font-mono">{k.kitCode}</td>
                    <td className="px-2 py-2">{k.name}</td>
                    <td className="px-2 py-2">{k.kitType}</td>
                    <td className="px-2 py-2">{Array.isArray(k.components) ? k.components.length : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="operations">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="font-semibold">Assemble Kits</p>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="Warehouse" /></SelectTrigger>
                  <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedKitId} onValueChange={setSelectedKitId}>
                  <SelectTrigger><SelectValue placeholder="Kit type" /></SelectTrigger>
                  <SelectContent>{(kits.data ?? []).map((k) => <SelectItem key={k.id} value={String(k.id)}>{k.kitCode} - {k.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                {isStaffOrAbove ? (
                  <Button
                    data-testid="kit-assemble-btn"
                    onClick={() => assembleMutation.mutate({ kitId: Number(selectedKitId), warehouseId: Number(warehouseId), quantity: Number(quantity) })}
                  >
                    Assemble
                  </Button>
                ) : null}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="font-semibold">Disassemble Kits</p>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="Warehouse" /></SelectTrigger>
                  <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedKitId} onValueChange={setSelectedKitId}>
                  <SelectTrigger><SelectValue placeholder="Kit type" /></SelectTrigger>
                  <SelectContent>{(kits.data ?? []).map((k) => <SelectItem key={k.id} value={String(k.id)}>{k.kitCode} - {k.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                {isStaffOrAbove ? (
                  <Button
                    data-testid="kit-disassemble-btn"
                    onClick={() => disassembleMutation.mutate({ kitId: Number(selectedKitId), warehouseId: Number(warehouseId), quantity: Number(quantity) })}
                  >
                    Disassemble
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Add Kit</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Label>Kit Code</Label>
            <Input value={kitCode} onChange={(e) => setKitCode(e.target.value)} />
            <Label>Name</Label>
            <Input value={kitName} onChange={(e) => setKitName(e.target.value)} />
            <Label>Type</Label>
            <Select value={kitType} onValueChange={setKitType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hygiene">hygiene</SelectItem>
                <SelectItem value="shelter">shelter</SelectItem>
                <SelectItem value="first_aid">first_aid</SelectItem>
                <SelectItem value="kitchen">kitchen</SelectItem>
                <SelectItem value="school">school</SelectItem>
                <SelectItem value="custom">custom</SelectItem>
              </SelectContent>
            </Select>
            <Label>Components</Label>
            {components.map((line, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-2">
                <Select value={line.catalogueId} onValueChange={(v) => setComponents((prev) => prev.map((x, i) => (i === idx ? { ...x, catalogueId: v } : x)))}>
                  <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                  <SelectContent>{(catalogue ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.itemCode} - {c.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Qty" value={line.quantity} onChange={(e) => setComponents((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))} />
              </div>
            ))}
            <Button variant="outline" onClick={() => setComponents((p) => [...p, { catalogueId: "", quantity: "" }])}>Add Component</Button>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    kitCode,
                    name: kitName,
                    kitType,
                    components: components
                      .filter((x) => x.catalogueId && Number(x.quantity) > 0)
                      .map((x) => ({ catalogueId: Number(x.catalogueId), quantity: Number(x.quantity) })),
                  })
                }
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
