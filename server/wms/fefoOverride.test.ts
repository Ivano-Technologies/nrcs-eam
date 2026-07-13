import { describe, expect, it } from "vitest";
import { sortFefoCandidates } from "./ctnAllocation";
import { detectFefoSkips } from "./fefoOverride";

describe("FEFO ordering", () => {
  it("sorts earliest expiry first with nulls last", () => {
    const sorted = sortFefoCandidates([
      { ctnId: 1, ctnCode: "A", balance: 10, expiryDate: null },
      { ctnId: 2, ctnCode: "B", balance: 10, expiryDate: "2026-08-01" },
      { ctnId: 3, ctnCode: "C", balance: 10, expiryDate: "2026-06-01" },
    ]);
    expect(sorted.map((c) => c.ctnId)).toEqual([3, 2, 1]);
  });
});

describe("detectFefoSkips", () => {
  it("warns when manual allocation skips earlier-expiring CTN", () => {
    const warnings = detectFefoSkips({
      candidates: [
        { ctnId: 1, ctnCode: "OLD", balance: 50, expiryDate: "2026-05-01" },
        { ctnId: 2, ctnCode: "NEW", balance: 50, expiryDate: "2026-09-01" },
      ],
      manualAllocations: [{ ctnId: 2, quantity: 10 }],
      todayIso: "2026-04-01",
    });
    expect(warnings.length).toBe(1);
    expect(warnings[0]!.skippedCtnId).toBe(1);
  });

  it("does not warn when FEFO order is followed", () => {
    const warnings = detectFefoSkips({
      candidates: [
        { ctnId: 1, ctnCode: "OLD", balance: 50, expiryDate: "2026-05-01" },
        { ctnId: 2, ctnCode: "NEW", balance: 50, expiryDate: "2026-09-01" },
      ],
      manualAllocations: [{ ctnId: 1, quantity: 10 }],
      todayIso: "2026-04-01",
    });
    expect(warnings.length).toBe(0);
  });
});
