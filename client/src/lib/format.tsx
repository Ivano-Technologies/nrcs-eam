import type { ReactNode } from "react";

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

type DateInput = Date | string | number | null | undefined;

function toValidDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "8 Oct 2026". Empty string for missing or invalid dates. */
export function formatDate(value: DateInput): string {
  const d = toValidDate(value);
  return d ? DATE_FORMAT.format(d) : "";
}

/** "8 Oct 2026, 10:04". Empty string for missing or invalid dates. */
export function formatDateTime(value: DateInput): string {
  const d = toValidDate(value);
  return d ? DATE_TIME_FORMAT.format(d) : "";
}

/** "8 Oct 2026 to 30 Oct 2026" for ranges. */
export function formatDateRange(start: DateInput, end: DateInput): string {
  const a = formatDate(start);
  const b = formatDate(end);
  if (a && b) return `${a} to ${b}`;
  return a || b;
}

/** Placeholder hint shown next to date inputs. */
export const DATE_INPUT_HINT = "DD/MM/YYYY";

/** Known enum values with hand written labels; anything else is humanised ("relief_item" → "Relief item"). */
const ENUM_LABELS: Record<string, string> = {
  relief_item: "Relief item",
  ppe: "PPE",
  grn: "GRN",
  ctn: "CTN",
  hq: "HQ",
  national_hq: "National HQ",
  national_headquarters: "National HQ",
  it_equipment: "IT equipment",
  ict: "ICT",
  login: "Signed in",
  logout: "Signed out",
  sign_in: "Signed in",
  sign_out: "Signed out",
  signin: "Signed in",
  signout: "Signed out",
  totalAssetValue: "Total asset value",
};

/** Turn a stored enum or camelCase key into sentence case text for the UI. */
export function formatEnumLabel(value: string | null | undefined): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (ENUM_LABELS[raw]) return ENUM_LABELS[raw];
  const lower = raw.toLowerCase();
  if (ENUM_LABELS[lower]) return ENUM_LABELS[lower];
  const words = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.:]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (/^[A-Z0-9]{2,}$/.test(w) ? w : w.toLowerCase()));
  if (!words.length) return "";
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

/**
 * Identity fields (name, facility, parent facility): show a muted "Not set" instead of a dash.
 * For numeric or optional columns leave the cell blank instead (use `value ?? ""`).
 */
export function formatEmpty(value: ReactNode): ReactNode {
  if (value == null) return <span className="text-muted-foreground">Not set</span>;
  if (typeof value === "string" && value.trim() === "") return <span className="text-muted-foreground">Not set</span>;
  return value;
}
