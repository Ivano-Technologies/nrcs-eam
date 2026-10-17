/**
 * Position designations (IVA-168). Job titles mapped to users, separate from the app role.
 * Organisation-wide positions have no facility; Branch Secretary is per branch.
 */
export const POSITION_VALUES = ["head_of_fleet", "branch_secretary", "gm_assets_admin", "sg"] as const;
export type PositionDesignation = (typeof POSITION_VALUES)[number];

export const POSITION_LABELS: Record<PositionDesignation, string> = {
  head_of_fleet: "Head of Fleet",
  branch_secretary: "Branch Secretary",
  gm_assets_admin: "GM Assets/Admin",
  sg: "SG",
};

/** Positions tied to one branch (they need a facility). */
export const PER_BRANCH_POSITIONS: readonly PositionDesignation[] = ["branch_secretary"];

export function isPerBranchPosition(p: PositionDesignation): boolean {
  return PER_BRANCH_POSITIONS.includes(p);
}
