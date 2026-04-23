import { describe, expect, it } from "vitest";
import { buildHistoricalStockMovement } from "./historicalImport";

describe("historical import stock movement mapping", () => {
  it("import for item with no stock_card uses bootstrap semantics then writes import movement", () => {
    const movement = buildHistoricalStockMovement({
      movementType: "receipt",
      quantity: 12,
      previousBalance: 0,
      date: "2026-04-23",
      documentRef: "HIST-001",
      createdBy: 99,
      stockCardId: 10,
    });
    expect(movement.row.stockCardId).toBe(10);
    expect(movement.row.sourceType).toBe("import");
    expect(movement.row.balanceAfter).toBe(12);
  });

  it("import with existing stock_card appends movement and computes balance correctly", () => {
    const movement = buildHistoricalStockMovement({
      movementType: "transfer_in",
      quantity: 7,
      previousBalance: 15,
      date: "2026-04-23",
      documentRef: "HIST-002",
      createdBy: 7,
      stockCardId: 77,
    });
    expect(movement.balanceAfter).toBe(22);
    expect(movement.quantityIn).toBe(7);
    expect(movement.quantityOut).toBe(0);
  });

  it("direction in sets quantityIn and leaves quantityOut zero", () => {
    const movement = buildHistoricalStockMovement({
      movementType: "adjustment",
      quantity: 4,
      previousBalance: 3,
      date: "2026-04-23",
      createdBy: 1,
      stockCardId: 1,
    });
    expect(movement.quantityIn).toBe(4);
    expect(movement.quantityOut).toBe(0);
  });

  it("direction out sets quantityOut and leaves quantityIn zero", () => {
    const movement = buildHistoricalStockMovement({
      movementType: "issue",
      quantity: 5,
      previousBalance: 14,
      date: "2026-04-23",
      createdBy: 1,
      stockCardId: 1,
    });
    expect(movement.quantityIn).toBe(0);
    expect(movement.quantityOut).toBe(5);
    expect(movement.balanceAfter).toBe(9);
  });
});

