/** A stock overview row is a catalogue item in a warehouse. */
export type StockKey = { catalogueId: number; warehouseId: number };

export const stockKeyId = (k: StockKey): string => `${k.catalogueId}:${k.warehouseId}`;

/** Remove duplicate catalogue and warehouse pairs, keeping first-seen order. */
export function dedupeStockKeys<T extends StockKey>(items: readonly T[]): StockKey[] {
  const seen = new Set<string>();
  const out: StockKey[] = [];
  for (const item of items) {
    const id = stockKeyId(item);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ catalogueId: item.catalogueId, warehouseId: item.warehouseId });
  }
  return out;
}

/** Parse a reorder level typed by the user. Returns null when it is not a whole or decimal number of 0 or more. */
export function parseReorderLevel(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return null;
  return n;
}
