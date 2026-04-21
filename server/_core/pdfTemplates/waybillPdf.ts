import { renderSimplePdf } from "./_shared";

export function generateWaybillPdf(payload: {
  title?: string;
  generatedAt?: string;
  rows: Array<{ label: string; value: string | number }>;
}) {
  return renderSimplePdf(
    payload.title ?? "Waybill",
    payload.generatedAt ?? new Date().toISOString(),
    payload.rows
  );
}
