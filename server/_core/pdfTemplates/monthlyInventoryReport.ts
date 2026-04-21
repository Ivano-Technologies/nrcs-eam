import { renderSimplePdf } from "./_shared";

export function generateMonthlyInventoryReportPdf(payload: {
  title?: string;
  generatedAt?: string;
  rows: Array<{ label: string; value: string | number }>;
}) {
  return renderSimplePdf(
    payload.title ?? "Monthly Inventory Intelligence Report",
    payload.generatedAt ?? new Date().toISOString(),
    payload.rows
  );
}
