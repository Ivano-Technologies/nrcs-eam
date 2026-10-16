export type CsvCell = string | number | null | undefined;

/** Characters that make spreadsheet apps treat a cell as a formula (CSV injection). */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Escape one CSV cell: neutralise formula prefixes, quote when needed, double inner quotes. */
export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && FORMULA_PREFIX.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build RFC 4180-style CSV text (CRLF line endings) from a header row and data rows. */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return [headers, ...rows].map((r) => r.map(escapeCsvCell).join(",")).join("\r\n");
}

/** Trigger a browser download of CSV text. A UTF-8 BOM keeps Excel from mangling ₦ and accents. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
