/**
 * IVA-180: register status badges use the success, warning and danger design tokens (not raw green,
 * amber and red), so they hold up in dark mode. Same pattern as requisition priority (IVA-159).
 */
export type StatusTone = "success" | "warning" | "danger";

export const STATUS_TONE_BADGE_CLASS: Record<StatusTone, string> = {
  success: "border-transparent bg-success-subtle text-success-foreground",
  warning: "border-transparent bg-warning-subtle text-warning-foreground",
  danger: "border-transparent bg-danger-subtle text-danger-foreground",
};

/** Text colour for a KPI value that needs attention. */
export const STATUS_TONE_TEXT_CLASS: Record<StatusTone, string> = {
  success: "text-success-foreground",
  warning: "text-warning-foreground",
  danger: "text-danger-foreground",
};
