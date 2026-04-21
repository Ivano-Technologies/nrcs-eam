import { renderSimplePdf } from "./_shared";

export function generateDistributionReportPdf(payload: {
  title?: string;
  generatedAt?: string;
  rows: Array<{ label: string; value: string | number }>;
}) {
  return renderSimplePdf(
    payload.title ?? "Distribution Impact Report",
    payload.generatedAt ?? new Date().toISOString(),
    payload.rows
  );
}
