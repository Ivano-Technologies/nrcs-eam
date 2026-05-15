import PDFDocument from "pdfkit";
import type { AssetValuationReport } from "./db";

function ngn(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

/** One-page executive summary for board / donor reporting. */
export function buildAssetValuationExecutivePdf(report: AssetValuationReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 44, bufferPages: false });
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(15).text("NRCS EAM — Asset Valuation Executive Summary", { underline: true });
    doc.moveDown(0.6);
    doc.fontSize(9).fillColor("#444").text(`Generated ${new Date().toISOString().slice(0, 10)} · Source: NRCS Asset Valuation Report 2026`);
    doc.fillColor("#000");
    doc.moveDown(1);

    doc.fontSize(11).text("1. Summary", { continued: false });
    doc.fontSize(9);
    doc.text(`Total certified property value: ${ngn(report.totalCertifiedPropertyNgn)}`);
    doc.text(`Total movable asset value (acquisition): ${ngn(report.totalMovableAcquisitionNgn)}`);
    doc.text(`Combined total asset value: ${ngn(report.combinedTotalNgn)}`);
    doc.text(
      `Properties valued: ${report.distinctSitesWithValuation} sites (${report.valuationRowCount} valuation rows) of ${report.totalFacilityCount} facilities.`
    );
    doc.moveDown(0.8);

    doc.fontSize(11).text("2. Pending formal property valuation");
    doc.fontSize(8.5);
    const pending = report.pendingValuation.slice(0, 35);
    for (const p of pending) {
      doc.text(`• ${p.facilityCode ?? "—"} — ${p.facilityName} (${p.state ?? "—"})`);
    }
    if (report.pendingValuation.length > pending.length) {
      doc.text(`… and ${report.pendingValuation.length - pending.length} more facilities.`);
    }
    doc.moveDown(0.8);

    doc.fontSize(11).text("3. Movable assets by category (excl. LA / LB)");
    doc.fontSize(8.5);
    for (const row of report.movableByCategory.slice(0, 22)) {
      doc.text(
        `• ${row.categoryName}: ${row.count} items · acquisition ${ngn(row.totalAcquisitionNgn)} · depreciated ${ngn(row.totalDepreciatedNgn)}`
      );
    }
    if (report.movableByCategory.length > 22) {
      doc.text(`… and ${report.movableByCategory.length - 22} more categories (see full register in EAM).`);
    }

    doc.end();
  });
}
