type FormatNairaOptions = {
  compact?: boolean;
};

export function formatNaira(amount: number, opts?: FormatNairaOptions): string {
  const compact = opts?.compact ?? false;
  const formatter = new Intl.NumberFormat("en-NG", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
    minimumFractionDigits: 0,
  });
  const raw = formatter.format(amount);
  const compactNormalized = compact ? raw.replace("T", "K").replace("B", "B").replace("M", "M") : raw;
  return `₦${compactNormalized}`;
}

const NAIRA_CARD_COMPACT_THRESHOLD = 1_000_000_000;

/** Summary cards: compact display for very large amounts; full value for tooltip/title. */
export function formatNairaSummaryCard(amount: number): { display: string; full: string } {
  const full = formatNaira(amount);
  const display =
    Math.abs(amount) >= NAIRA_CARD_COMPACT_THRESHOLD ? formatNaira(amount, { compact: true }) : full;
  return { display, full };
}
