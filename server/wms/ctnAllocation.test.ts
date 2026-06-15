import { describe, expect, it } from "vitest";
import {
  allocateFefoFromCandidates,
  isCtnExpired,
  sortFefoCandidates,
  type CtnAllocationCandidate,
} from "./ctnAllocation";

const TODAY = "2026-06-15";

function candidate(
  ctnId: number,
  ctnCode: string,
  balance: number,
  expiryDate: string | null
): CtnAllocationCandidate {
  return { ctnId, ctnCode, balance, expiryDate };
}

describe("ctnAllocation FEFO", () => {
  it("sorts by expiry ascending with nulls last", () => {
    const sorted = sortFefoCandidates([
      candidate(3, "C", 10, null),
      candidate(1, "A", 10, "2026-07-01"),
      candidate(2, "B", 10, "2026-06-20"),
    ]);
    expect(sorted.map((r) => r.ctnId)).toEqual([2, 1, 3]);
  });

  it("allocates from a single CTN", () => {
    const out = allocateFefoFromCandidates([candidate(1, "A", 50, "2026-12-01")], 20, TODAY);
    expect(out).toEqual([{ ctnId: 1, quantity: 20 }]);
  });

  it("splits across multiple CTNs in FEFO order", () => {
    const out = allocateFefoFromCandidates(
      [
        candidate(1, "A", 10, "2026-07-01"),
        candidate(2, "B", 15, "2026-08-01"),
      ],
      20,
      TODAY
    );
    expect(out).toEqual([
      { ctnId: 1, quantity: 10 },
      { ctnId: 2, quantity: 10 },
    ]);
  });

  it("skips expired CTNs", () => {
    expect(() =>
      allocateFefoFromCandidates([candidate(1, "A", 50, "2026-01-01")], 10, TODAY)
    ).toThrow(/Insufficient non-expired stock/);
  });

  it("throws when stock is insufficient", () => {
    expect(() =>
      allocateFefoFromCandidates([candidate(1, "A", 5, "2026-12-01")], 10, TODAY)
    ).toThrow(/Insufficient non-expired stock/);
  });

  it("detects expired CTNs by date", () => {
    expect(isCtnExpired("2026-01-01", TODAY)).toBe(true);
    expect(isCtnExpired("2026-12-01", TODAY)).toBe(false);
    expect(isCtnExpired(null, TODAY)).toBe(false);
  });
});
