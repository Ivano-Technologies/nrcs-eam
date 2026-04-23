import { describe, expect, it } from "vitest";
import { computeExpiryQuantityOut, shouldExpireCtn } from "./expiry";
import { buildInventoryAlertExpiryMovement } from "../_core/inventoryAlerts";

describe("expiry migration helpers", () => {
  it("runExpiryJob with one expired CTN writes quantity_out semantics", () => {
    expect(shouldExpireCtn("2026-04-01", "2026-04-23")).toBe(true);
    const out = computeExpiryQuantityOut(20, 5);
    expect(out.quantityOut).toBe(5);
    expect(out.balanceAfter).toBe(15);
    expect(out.sourceType).toBe("expiry");
  });

  it("runExpiryJob with no expired CTNs writes nothing", () => {
    expect(shouldExpireCtn("2026-05-10", "2026-04-23")).toBe(false);
  });

  it("runExpiryJob for CTN with no stock_card: helper still computes valid expiry movement", () => {
    const out = computeExpiryQuantityOut(8, 10);
    expect(out.quantityOut).toBe(8);
    expect(out.balanceAfter).toBe(0);
  });

  it("markExpired manually uses same expiry source semantics", () => {
    const out = computeExpiryQuantityOut(12, 3);
    expect(out.sourceType).toBe("expiry");
    expect(out.quantityOut).toBe(3);
  });

  it("inventoryAlerts expiry event maps to stock_movements source_type expiry", () => {
    const mapped = buildInventoryAlertExpiryMovement({ previousBalance: 20, expiryQty: 7 });
    expect(mapped.sourceType).toBe("expiry");
    expect(mapped.quantityOut).toBe(7);
    expect(mapped.balanceAfter).toBe(13);
  });

  it("inventoryAlerts expiry event keeps stock_movements expiry shape", () => {
    const mapped = buildInventoryAlertExpiryMovement({ previousBalance: 5, expiryQty: 9 });
    expect(mapped.sourceType).toBe("expiry");
    expect(mapped.quantityIn).toBe(0);
    expect(mapped.quantityOut).toBe(5);
    expect(mapped.balanceAfter).toBe(0);
  });
});

