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
