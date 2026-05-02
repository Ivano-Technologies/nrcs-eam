import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SignatureValue = {
  mode: "typed" | "pad";
  name: string;
  date: string;
  functionTitle: string;
  signatureText: string;
};

export function SignatureBlock({
  title,
  value,
  onChange,
  nameTestId,
}: {
  title: string;
  value: SignatureValue;
  onChange: (next: SignatureValue) => void;
  /** Stable hook for E2E (Name is otherwise ambiguous among several textboxes). */
  nameTestId?: string;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="font-medium">{title}</div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Mode</Label>
          <Select
            value={value.mode}
            onValueChange={(mode) => onChange({ ...value, mode: mode as SignatureValue["mode"] })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="typed">Typed name + date + function</SelectItem>
              <SelectItem value="pad">Signature pad (placeholder)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Name</Label>
          <Input
            className="h-9"
            data-testid={nameTestId}
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>Date</Label>
          <Input
            className="h-9"
            type="date"
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>Function</Label>
          <Input
            className="h-9"
            value={value.functionTitle}
            onChange={(e) => onChange({ ...value, functionTitle: e.target.value })}
          />
        </div>
      </div>
      {value.mode === "typed" ? (
        <div className="space-y-1">
          <Label>Signature (typed)</Label>
          <Input
            className="h-9"
            value={value.signatureText}
            onChange={(e) => onChange({ ...value, signatureText: e.target.value })}
            placeholder="Type name as signature"
          />
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Signature pad mode placeholder — default typed mode is active per current facility preference.
        </div>
      )}
    </div>
  );
}

