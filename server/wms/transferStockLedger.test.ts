import { describe, expect, it } from "vitest";
import { allocateFefoFromCandidates, isCtnExpired } from "./ctnAllocation";
import { computeTransferDispatch, computeTransferReceive } from "./transfers";

describe("transferStockLedger helpers", () => {
  it("FEFO allocation sums to line quantity for multi-CTN transfer line", () => {
    const allocations = allocateFefoFromCandidates(
      [
        { ctnId: 10, ctnCode: "CTN-A", balance: 6, expiryDate: "2026-08-01" },
        { ctnId: 11, ctnCode: "CTN-B", balance: 10, expiryDate: "2026-09-01" },
      ],
      12,
      "2026-06-15"
    );
    const sourceQty = allocations.reduce((sum, row) => sum + row.quantity, 0);
    expect(sourceQty).toBe(12);
    expect(allocations).toHaveLength(2);
  });

  it("computeTransferDispatch reduces balance and sets transfer_out", () => {
    const result = computeTransferDispatch(20, 5);
    expect(result.quantityOut).toBe(5);
    expect(result.balanceAfter).toBe(15);
    expect(result.sourceType).toBe("transfer_out");
  });

  it("computeTransferReceive increases balance and sets transfer_in", () => {
    const result = computeTransferReceive(3, 7);
    expect(result.quantityIn).toBe(7);
    expect(result.balanceAfter).toBe(10);
    expect(result.sourceType).toBe("transfer_in");
  });

  it("computeTransferDispatch rejects insufficient stock", () => {
    expect(() => computeTransferDispatch(2, 5)).toThrow("Insufficient stock");
  });

  it("isCtnExpired flags past expiry dates", () => {
    expect(isCtnExpired("2026-01-01", "2026-06-15")).toBe(true);
    expect(isCtnExpired("2026-12-01", "2026-06-15")).toBe(false);
    expect(isCtnExpired(null, "2026-06-15")).toBe(false);
  });
});
