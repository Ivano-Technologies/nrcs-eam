export type CopyType = "white" | "green" | "blue" | "yellow";

export const COPY_WATERMARK: Record<CopyType, string> = {
  white: "ORIGINAL",
  green: "REPORTING COPY",
  blue: "LOGISTICS FILE",
  yellow: "WAREHOUSE COPY",
};

export function printStyles(): string {
  return `
    @page { size: A4 portrait; margin: 10mm; }
    @media print {
      .no-print { display: none !important; }
      [data-slot="sidebar"], [data-slot="sidebar-inset"] > header, footer { display: none !important; }
      .print-a4 { max-width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
    }
  `;
}
