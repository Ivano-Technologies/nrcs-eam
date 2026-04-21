import { renderSimplePdf } from "./_shared";

export function generateGrnPdf(payload: {
  title?: string;
  generatedAt?: string;
  rows: Array<{ label: string; value: string | number }>;
}) {
  return renderSimplePdf(
    payload.title ?? "Goods Received Note (GRN)",
    payload.generatedAt ?? new Date().toISOString(),
    payload.rows
  );
}
