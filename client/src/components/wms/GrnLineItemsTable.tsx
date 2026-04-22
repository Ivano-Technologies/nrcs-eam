import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export type GrnLineItem = {
  consignmentNumber: string;
  description: string;
  ctnId: string;
  nbOfUnits: string;
  unitType: string;
  weightKg: string;
  receivedInGoodCondition: boolean;
  claimNotes: string;
};

const UNIT_OPTIONS = ["pieces", "bales", "boxes", "cans", "bags", "kg", "L"];

export function GrnLineItemsTable({
  lines,
  ctnOptions,
  onChange,
  onAddLine,
  onRemoveLine,
}: {
  lines: GrnLineItem[];
  ctnOptions: Array<{ id: number; label: string }>;
  onChange: (next: GrnLineItem[]) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
}) {
  const update = (index: number, patch: Partial<GrnLineItem>) => {
    onChange(lines.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Consignment #</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>CTN</TableHead>
            <TableHead>Number of units</TableHead>
            <TableHead>Unit type</TableHead>
            <TableHead>Weight kg</TableHead>
            <TableHead>Good condition</TableHead>
            <TableHead>Claim notes</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, index) => (
            <TableRow key={index}>
              <TableCell>
                <Input
                  className="h-9 min-w-[140px]"
                  value={line.consignmentNumber}
                  onChange={(e) => update(index, { consignmentNumber: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Input
                  className="h-9 min-w-[220px]"
                  value={line.description}
                  onChange={(e) => update(index, { description: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Select value={line.ctnId || undefined} onValueChange={(v) => update(index, { ctnId: v })}>
                  <SelectTrigger className="h-9 min-w-[220px]">
                    <SelectValue placeholder="Select CTN" />
                  </SelectTrigger>
                  <SelectContent>
                    {ctnOptions.map((opt) => (
                      <SelectItem key={opt.id} value={String(opt.id)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  className="h-9 min-w-[120px]"
                  inputMode="decimal"
                  value={line.nbOfUnits}
                  onChange={(e) => update(index, { nbOfUnits: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && index === lines.length - 1) onAddLine();
                  }}
                />
              </TableCell>
              <TableCell>
                <Select value={line.unitType || undefined} onValueChange={(v) => update(index, { unitType: v })}>
                  <SelectTrigger className="h-9 min-w-[120px]">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  className="h-9 min-w-[100px]"
                  inputMode="decimal"
                  value={line.weightKg}
                  onChange={(e) => update(index, { weightKg: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={line.receivedInGoodCondition}
                    onCheckedChange={(checked) => update(index, { receivedInGoodCondition: !!checked })}
                  />
                  <span className="text-xs">Yes</span>
                </div>
              </TableCell>
              <TableCell>
                {line.receivedInGoodCondition ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <Textarea
                    className="min-h-[38px] min-w-[220px]"
                    value={line.claimNotes}
                    onChange={(e) => update(index, { claimNotes: e.target.value })}
                  />
                )}
              </TableCell>
              <TableCell>
                <Button type="button" variant="outline" size="sm" onClick={() => onRemoveLine(index)} disabled={lines.length === 1}>
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button type="button" variant="outline" onClick={onAddLine}>
        Add line
      </Button>
    </div>
  );
}

