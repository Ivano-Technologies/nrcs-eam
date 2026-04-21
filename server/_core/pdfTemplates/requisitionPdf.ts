import { renderSimplePdf } from "./_shared";

export function generateRequisitionPdf(payload: {
  title?: string;
  generatedAt?: string;
  rows: Array<{ label: string; value: string | number }>;
}) {
  return renderSimplePdf(
    payload.title ?? "Requisition",
    payload.generatedAt ?? new Date().toISOString(),
    payload.rows
  );
}
