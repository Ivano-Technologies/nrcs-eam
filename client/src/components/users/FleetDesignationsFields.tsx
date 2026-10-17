import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  isPerBranchPosition,
  POSITION_LABELS,
  POSITION_VALUES,
  type PositionDesignation,
} from "@shared/fleetPositions";

export type FleetDesignationsValue = { isDriver: boolean; positions: PositionDesignation[] };
/** Someone else holds a position this user is being given (one holder per position). */
export type PositionHolderConflict = { position: PositionDesignation; holderName: string };

/**
 * IVA-168: driver flag and position designations in the admin Edit user dialog. Positions are job titles,
 * separate from the app role. Branch Secretary applies to the user's assigned facility.
 * One holder per position: a clash shows inline with the current holder and a Reassign option.
 * Any active user can be a driver, whatever their role.
 */
export function FleetDesignationsFields({
  available,
  value,
  facilityName,
  onChange,
  userName = "this user",
  driverEligible = true,
  conflicts = [],
  reassign = [],
  onReassignChange,
}: {
  available: boolean;
  value: FleetDesignationsValue;
  facilityName: string | null;
  onChange: (next: FleetDesignationsValue) => void;
  userName?: string;
  driverEligible?: boolean;
  conflicts?: PositionHolderConflict[];
  reassign?: PositionDesignation[];
  onReassignChange?: (next: PositionDesignation[]) => void;
}) {
  if (!available) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="fleet-designations-unavailable">
        Positions and the driver flag need database migration 0061.
      </p>
    );
  }
  const toggle = (p: PositionDesignation, on: boolean) =>
    onChange({
      ...value,
      positions: on ? [...value.positions.filter((x) => x !== p), p] : value.positions.filter((x) => x !== p),
    });
  return (
    <fieldset className="space-y-3 border-t pt-3" data-testid="fleet-designations">
      <legend className="sr-only">Fleet</legend>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor="edit-user-driver">Driver</Label>
          <p className="text-xs text-muted-foreground">
            {driverEligible
              ? "Only flagged drivers can be put on a booking or trip."
              : "Only active users can be drivers."}
          </p>
        </div>
        <Switch
          id="edit-user-driver"
          className="mt-0.5 h-[1.15rem] w-8 shrink-0"
          checked={driverEligible && value.isDriver}
          disabled={!driverEligible}
          onCheckedChange={(c) => onChange({ ...value, isDriver: c })}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Positions</p>
        {POSITION_VALUES.map((p) => {
          const perBranch = isPerBranchPosition(p);
          const blocked = perBranch && !facilityName;
          const checked = value.positions.includes(p);
          return (
            <div key={p} className="flex items-start gap-2">
              <Checkbox
                id={`edit-user-position-${p}`}
                checked={checked}
                disabled={blocked && !checked}
                onCheckedChange={(c) => toggle(p, c === true)}
              />
              <div className="space-y-0.5">
                <Label htmlFor={`edit-user-position-${p}`} className="font-normal">
                  {POSITION_LABELS[p]}
                  {perBranch && facilityName ? ` · ${facilityName}` : ""}
                </Label>
                {blocked ? <p className="text-xs text-muted-foreground">Set a facility first.</p> : null}
                {checked
                  ? (() => {
                      const clash = conflicts.find((c) => c.position === p);
                      if (!clash) return null;
                      const moving = reassign.includes(p);
                      return moving ? (
                        <p className="text-xs text-muted-foreground" data-testid={`position-reassign-${p}`}>
                          Moves from {clash.holderName} to {userName} when you save.{" "}
                          <button
                            type="button"
                            data-inline-link
                            className="inline align-baseline text-xs font-medium text-primary underline-offset-4 hover:underline dark:text-primary-on-dark"
                            onClick={() => onReassignChange?.(reassign.filter((x) => x !== p))}
                          >
                            Undo
                          </button>
                        </p>
                      ) : (
                        <div role="alert" className="space-y-1" data-testid={`position-conflict-${p}`}>
                          <p className="text-xs font-medium text-danger dark:text-primary-on-dark">
                            {clash.holderName} already holds this position. Each position has one holder.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onReassignChange?.([...reassign, p])}
                          >
                            Reassign to {userName}
                          </Button>
                        </div>
                      );
                    })()
                  : null}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">Positions don't change what the user can access.</p>
      </div>
    </fieldset>
  );
}

/** Small badges for the Users table: Driver plus each position. */
export function FleetDesignationBadges({
  isDriver,
  positions,
}: {
  isDriver: boolean;
  positions: { position: PositionDesignation; siteName: string | null }[];
}) {
  if (!isDriver && positions.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1" data-testid="fleet-designation-badges">
      {isDriver ? (
        <Badge variant="outline" className="text-xs font-normal">
          Driver
        </Badge>
      ) : null}
      {positions.map((p) => (
        <Badge key={`${p.position}-${p.siteName ?? ""}`} variant="outline" className="text-xs font-normal">
          {POSITION_LABELS[p.position]}
          {isPerBranchPosition(p.position) && p.siteName ? ` · ${p.siteName}` : ""}
        </Badge>
      ))}
    </div>
  );
}
