import type { FleetHealthSummary } from "./fleetHealth";

export async function renderFleetHealthPdf(data: FleetHealthSummary): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const margin = 36;
    let y = 36;
    doc.fontSize(14).fillColor("#111827").text("NRCS Fleet Health Summary", margin, y);
    y += 22;
    doc.fontSize(10).fillColor("#6B7280").text(`Report date: ${data.reportDate}`, margin, y);
    y += 28;

    const ow = data.orgWide;
    doc.fontSize(11).fillColor("#111827").text("Organisation-wide KPIs", margin, y);
    y += 16;
    doc.fontSize(9).fillColor("#374151");
    doc.text(`Total book value: ${ow.totalBookValue.toLocaleString()}`, margin, y);
    y += 14;
    doc.text(`Assets past 80% useful life: ${ow.endOfLifeCount}`, margin, y);
    y += 14;
    doc.text(`High-priority maintenance predictions: ${ow.highPriorityPredictions.length}`, margin, y);
    y += 14;
    const overdue =
      ow.openWorkOrdersByAge.days15to30 + ow.openWorkOrdersByAge.days30plus;
    doc.text(`Open work orders (15+ days): ${overdue}`, margin, y);
    y += 14;
    doc.text(`Active inventory alerts: ${ow.activeInventoryAlerts}`, margin, y);
    y += 24;

    doc.fontSize(11).text("By branch / site", margin, y);
    y += 14;
    for (const site of data.bySite.slice(0, 12)) {
      doc.fontSize(8).fillColor("#374151").text(
        `${site.siteName}: book ${site.totalBookValue.toLocaleString()}, EOL ${site.endOfLifeCount}, predictions ${site.highPriorityPredictions.length}`,
        margin,
        y,
        { width: doc.page.width - margin * 2 }
      );
      y += 12;
      if (y > doc.page.height - 60) break;
    }

    doc.end();
  });
}
