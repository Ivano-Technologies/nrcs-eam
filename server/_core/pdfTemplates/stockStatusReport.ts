import { renderSimplePdf } from "./_shared";

export function generateStockStatusReportPdf(payload: {
  title?: string;
  generatedAt?: string;
  rows: Array<{ label: string; value: string | number }>;
}) {
  return renderSimplePdf(
    payload.title ?? "Stock Status Report",
    payload.generatedAt ?? new Date().toISOString(),
    payload.rows
  );
}
