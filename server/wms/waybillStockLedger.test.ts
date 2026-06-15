import { describe, expect, it } from "vitest";
import { allocateFefoFromCandidates } from "./ctnAllocation";

describe("waybill fulfill allocation integration", () => {
  it("multi-CTN fulfill line matches waybill_line_ctn_sources sum", () => {
    const allocations = allocateFefoFromCandidates(
      [
        { ctnId: 10, ctnCode: "CTN-A", balance: 6, expiryDate: "2026-08-01" },
        { ctnId: 11, ctnCode: "CTN-B", balance: 10, expiryDate: "2026-09-01" },
      ],
      12,
      "2026-06-15"
    );
    const lineQty = 12;
    const sourceQty = allocations.reduce((sum, row) => sum + row.quantity, 0);
    expect(sourceQty).toBe(lineQty);
    expect(allocations).toHaveLength(2);
  });
});
