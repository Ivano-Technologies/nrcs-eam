export type ComplianceRegisterTab = "vehicles" | "generators" | "buildings" | "donor" | "insurance";

/**
 * Read ?tab= and ?status= for the Compliance register. wouter's location has no query string, so pass
 * its useSearch() value (with or without the leading "?").
 */
export function parseComplianceRegisterQuery(search: string): { tab: ComplianceRegisterTab; status: string | null } {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tab = q.get("tab") as ComplianceRegisterTab | null;
  return { tab: tab ?? "vehicles", status: q.get("status") };
}
