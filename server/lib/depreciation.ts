/**
 * NRCS register depreciation by item category (annual rate applied geometrically by age).
 * Kept separate from `server/depreciation.ts` (legacy acquisition-cost / useful-life engine).
 */

const DEPRECIATION_RATES: Record<string, number> = {
  Vehicle: 0.2,
  Computer: 0.33,
  "Furniture & Fixtures": 0.1,
  "Land & Building": 0.02,
  Land: 0,
  "Medical Equipment": 0.1,
  "Office Equipment": 0.1,
  Generator: 0.2,
};

const DEFAULT_RATE = 0.1;

export function calculateDepreciatedValue(
  actualValue: number,
  itemCategory: string,
  yearAcquired: number
): number {
  const rate = DEPRECIATION_RATES[itemCategory] ?? DEFAULT_RATE;
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - yearAcquired);
  const depreciated = actualValue * Math.pow(1 - rate, age);
  return Math.max(0, Math.round(depreciated * 100) / 100);
}
