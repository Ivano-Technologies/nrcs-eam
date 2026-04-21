import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { UserRole } from "./types";

const ALL_ROLES: UserRole[] = ["Admin", "Manager", "Staff", "Field"];

type Props = {
  actualRole: UserRole;
  value: UserRole;
  onChange: (role: UserRole) => void;
};

export function RoleSwitcher({ actualRole, value, onChange }: Props) {
  if (actualRole !== "Admin") return null;

  const isPreviewing = value !== actualRole;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="whitespace-nowrap text-sm text-muted-foreground">View as:</span>
      <Select value={value} onValueChange={(v) => onChange(v as UserRole)}>
        <SelectTrigger
          className={cn(
            "relative h-[38px] shrink-0 overflow-visible rounded-lg border px-3",
            isPreviewing && "ring-2 ring-red-200 dark:ring-red-900/60"
          )}
          aria-label={isPreviewing ? `Previewing dashboard as ${value}` : "Dashboard role"}
        >
          <SelectValue placeholder="View as" />
          {isPreviewing ? (
            <span
              className="pointer-events-none absolute right-2 top-2 size-1 rounded-full bg-red-500 ring-2 ring-background"
              aria-hidden
            />
          ) : null}
        </SelectTrigger>
        <SelectContent align="end">
          {ALL_ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
