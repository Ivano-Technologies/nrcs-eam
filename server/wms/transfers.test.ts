import { describe, expect, it } from "vitest";
import { computeTransferDispatch, computeTransferReceive, shouldBootstrapStockCard } from "./transfers";

describe("transfers migration helpers", () => {
  it("dispatch writes transfer_out semantics and decrements source balance", () => {
    const out = computeTransferDispatch(100, 15);
    expect(out.sourceType).toBe("transfer_out");
    expect(out.quantityOut).toBe(15);
    expect(out.balanceAfter).toBe(85);
  });

  it("receive writes transfer_in semantics and increments destination balance", () => {
    const out = computeTransferReceive(10, 8);
    expect(out.sourceType).toBe("transfer_in");
    expect(out.quantityIn).toBe(8);
    expect(out.balanceAfter).toBe(18);
  });

  it("dispatch more than available balance returns error", () => {
    expect(() => computeTransferDispatch(3, 4)).toThrow(/insufficient/i);
  });

  it("dispatch from facility with no stock_card triggers bootstrap", () => {
    expect(shouldBootstrapStockCard(0)).toBe(true);
    expect(shouldBootstrapStockCard(1)).toBe(false);
  });
});

