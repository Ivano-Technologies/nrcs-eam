import type { DonorStatementResult } from "./donorStatement";

export async function renderDonorStatementPdf(data: DonorStatementResult): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const margin = 36;
    let y = 36;
    doc.fontSize(14).text("Donor Accountability Statement", margin, y);
    y += 20;
    doc.fontSize(10).text(`${data.donorName} (${data.donorCode})`, margin, y);
    y += 14;
    doc.text(`Period: ${data.periodFrom} — ${data.periodTo}`, margin, y);
    y += 24;

    doc.fontSize(9);
    for (const line of data.lines.slice(0, 20)) {
      doc.text(
        `${line.itemName}: open ${line.openingBalance} + recv ${line.received} - dist ${line.distributed} - loss ${line.losses} = close ${line.closingBalance}`,
        margin,
        y,
        { width: doc.page.width - margin * 2 }
      );
      y += 14;
      if (y > doc.page.height - 80) break;
    }

    if (data.discrepancies.length > 0) {
      y += 10;
      doc.fillColor("#B45309").text("Reconciliation notes:", margin, y);
      y += 12;
      doc.fillColor("#111827");
      for (const d of data.discrepancies.slice(0, 5)) {
        doc.fontSize(8).text(d, margin, y, { width: doc.page.width - margin * 2 });
        y += 20;
      }
    }

    doc.end();
  });
}
