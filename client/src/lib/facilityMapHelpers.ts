export type StockTier = "all" | "adequate" | "partial" | "low" | "none";

export type StockPinInput = {
  isActive: boolean;
  stockScorePercent: number | null;
  totalCards: number;
};

const STOCK_COLOURS = {
  adequate: "#16A34A",
  partial: "#EAB308",
  low: "#DC2626",
  offline: "#9CA3AF",
} as const;

export function stockPinColorForTest(facility: StockPinInput): string {
  if (!facility.isActive) return STOCK_COLOURS.offline;
  const score = facility.stockScorePercent;
  if (score == null || facility.totalCards === 0) return STOCK_COLOURS.offline;
  if (score >= 75) return STOCK_COLOURS.adequate;
  if (score >= 50) return STOCK_COLOURS.partial;
  return STOCK_COLOURS.low;
}

export function matchesStockTierForTest(facility: StockPinInput, tier: StockTier): boolean {
  if (tier === "all") return true;
  if (!facility.isActive) return tier === "none";
  const score = facility.stockScorePercent;
  if (score == null || facility.totalCards === 0) return tier === "none";
  if (tier === "adequate") return score >= 75;
  if (tier === "partial") return score >= 50 && score < 75;
  if (tier === "low") return score < 50;
  return false;
}
