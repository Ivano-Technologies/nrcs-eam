export type ExportDocumentType = "grn" | "waybill" | "stock-card" | "bin-card" | "monthly-report";
export type ExportFormat = "pdf" | "xlsx";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function fetchDocumentExport(documentType: ExportDocumentType, id: number, format: ExportFormat, copyType?: string) {
  const query = new URLSearchParams({ format });
  if (copyType) query.set("copy", copyType);
  const response = await fetch(`/api/documents/${documentType}/${id}/export?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`);
  }
  const blob = await response.blob();
  const fileBase = `${documentType}-${id}${copyType ? `-${copyType}` : ""}`;
  return {
    blob,
    filename: `${fileBase}.${format}`,
  };
}

export async function toPDF(documentType: ExportDocumentType, id: number, copyType?: string) {
  return fetchDocumentExport(documentType, id, "pdf", copyType);
}

export async function toExcel(documentType: ExportDocumentType, id: number) {
  return fetchDocumentExport(documentType, id, "xlsx");
}
