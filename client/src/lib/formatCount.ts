/** Whole numbers with thousands separators, for example 1234 -> "1,234". */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(n);
}

/** Split ids into chunks no larger than the bulk endpoint limit. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
