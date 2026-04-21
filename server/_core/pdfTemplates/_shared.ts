import PDFDocument from "pdfkit";

export function renderSimplePdf(title: string, subtitle: string, rows: Array<{ label: string; value: string | number }>) {
  const doc = new PDFDocument({ margin: 40 });
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.rect(0, 0, doc.page.width, 80).fill("#DC2626");
    doc.fillColor("white").fontSize(18).text("Nigerian Red Cross Society", 40, 28);
    doc.fillColor("white").fontSize(12).text("Enterprise Asset Management", 40, 50);

    doc.fillColor("#111827").fontSize(16).text(title, 40, 100);
    doc.fillColor("#6B7280").fontSize(10).text(subtitle, 40, 122);
    let y = 150;
    for (const row of rows) {
      doc.fillColor("#111827").fontSize(11).text(`${row.label}: `, 40, y, { continued: true });
      doc.fillColor("#374151").text(String(row.value), { continued: false });
      y += 18;
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 40;
      }
    }
    doc.end();
  });
}
