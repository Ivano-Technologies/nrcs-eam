/**
 * ?status= deep links for list pages. Only a page's real filter values are accepted; a missing or unknown
 * value falls back to "all", so opening a page without ?status resets the filter instead of keeping the
 * last one. Pass wouter's useSearch() value (with or without the leading "?").
 */
export const RECEIPT_STATUS_FILTERS = ["all", "draft", "pending_approval", "finalized", "claim_raised"] as const;
export const STOCK_COUNT_STATUS_FILTERS = ["all", "draft", "in_progress", "pending_review", "approved"] as const;
export const REQUISITION_STATUS_FILTERS = [
  "all",
  "draft",
  "submitted",
  "branch_approved",
  "hq_approved",
  "fulfilled",
  "rejected",
  "cancelled",
] as const;
export const FACILITY_STATUS_FILTERS = ["all", "active", "inactive"] as const;

export function statusFilterFromSearch<T extends string>(search: string, allowed: readonly T[]): T | "all" {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("status");
  return raw != null && (allowed as readonly string[]).includes(raw) ? (raw as T) : "all";
}
