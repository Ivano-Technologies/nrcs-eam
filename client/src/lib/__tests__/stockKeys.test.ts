import { describe, expect, it } from "vitest";
import { dedupeStockKeys, parseReorderLevel, stockKeyId } from "@shared/stockKeys";

describe("stock keys", () => {
  it("dedupes catalogue and warehouse pairs in order", () => {
    expect(
      dedupeStockKeys([
        { catalogueId: 1, warehouseId: 5 },
        { catalogueId: 2, warehouseId: 5 },
        { catalogueId: 1, warehouseId: 5 },
        { catalogueId: 1, warehouseId: 6 },
      ])
    ).toEqual([
      { catalogueId: 1, warehouseId: 5 },
      { catalogueId: 2, warehouseId: 5 },
      { catalogueId: 1, warehouseId: 6 },
    ]);
    expect(stockKeyId({ catalogueId: 3, warehouseId: 9 })).toBe("3:9");
  });

  it("parses reorder levels", () => {
    expect(parseReorderLevel("25")).toBe(25);
    expect(parseReorderLevel(" 1,200 ")).toBe(1200);
    expect(parseReorderLevel("2.5")).toBe(2.5);
    expect(parseReorderLevel("0")).toBe(0);
    expect(parseReorderLevel("")).toBeNull();
    expect(parseReorderLevel("-3")).toBeNull();
    expect(parseReorderLevel("abc")).toBeNull();
    expect(parseReorderLevel("1e3")).toBeNull();
    expect(parseReorderLevel("2000000000")).toBeNull();
  });
});
