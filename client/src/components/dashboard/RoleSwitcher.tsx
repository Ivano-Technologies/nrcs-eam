import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole } from "./types";

const ALL_ROLES: UserRole[] = ["Admin", "Manager", "Staff", "Field"];

type Props = {
  actualRole: UserRole;
  value: UserRole;
  onChange: (role: UserRole) => void;
};

export function RoleSwitcher({ actualRole, value, onChange }: Props) {
  if (actualRole !== "Admin") return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">View as:</span>
      <Select value={value} onValueChange={(v) => onChange(v as UserRole)}>
        <SelectTrigger className="h-[38px] rounded-lg border px-3">
          <SelectValue placeholder="View as" />
        </SelectTrigger>
        <SelectContent align="end">
          {ALL_ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value !== actualRole ? <span className="text-xs text-muted-foreground">Previewing as {value}</span> : null}
    </div>
  );
}
