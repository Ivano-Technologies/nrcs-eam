import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { documentComplianceStatus, tallyStatus } from "./complianceTrackingDb";

// IVA-168: a missing expiry date is its own "no_date" status, not compliant and not expired.
describe("documentComplianceStatus no_date (IVA-168)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("is no_date when every date is missing", () => {
    expect(documentComplianceStatus([null, null, null])).toBe("no_date");
    expect(documentComplianceStatus([])).toBe("no_date");
  });

  it("is no_date when any date is missing and the others are valid", () => {
    expect(documentComplianceStatus(["2027-06-01", null, "2027-08-01"])).toBe("no_date");
  });

  it("lets expired and expiring beat no_date", () => {
    expect(documentComplianceStatus(["2026-10-01", null])).toBe("non_compliant");
    expect(documentComplianceStatus(["2026-11-01", null])).toBe("expiring");
  });

  it("stays compliant when every date is present and valid", () => {
    expect(documentComplianceStatus(["2027-06-01", "2027-07-01", "2027-08-01"])).toBe("compliant");
  });

  it("counts no_date separately in the summary tally", () => {
    expect(tallyStatus(["compliant", "no_date", "no_date", "expiring", "non_compliant", "serviced"])).toEqual({
      compliantCount: 2,
      expiringSoonCount: 1,
      nonCompliantCount: 1,
      noDateCount: 2,
    });
  });
});
