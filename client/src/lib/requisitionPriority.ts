/**
 * Requisition priority badge styles (IVA-159). Emergency uses the danger tokens and Urgent the warning
 * tokens; Routine is neutral. Brand red (primary) never signals priority.
 */
export type RequisitionPriority = "emergency" | "urgent" | "routine";

const NEUTRAL = "border-border bg-secondary text-secondary-foreground";

export const REQUISITION_PRIORITY_BADGE_CLASS: Record<RequisitionPriority, string> = {
  emergency: "border-transparent bg-danger-subtle text-danger-foreground",
  urgent: "border-transparent bg-warning-subtle text-warning-foreground",
  routine: NEUTRAL,
};

export function requisitionPriorityBadgeClass(priority?: string | null): string {
  return REQUISITION_PRIORITY_BADGE_CLASS[(priority ?? "routine") as RequisitionPriority] ?? NEUTRAL;
}
