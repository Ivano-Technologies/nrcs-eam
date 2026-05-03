import fs from "node:fs";
import path from "node:path";
import type { BranchSummaryReport } from "./branchSummary";

let logoBuffer: Buffer | null | undefined;

function getLogoBuffer(): Buffer | null {
  if (logoBuffer !== undefined) return logoBuffer;
  const candidates = [
    path.join(process.cwd(), "client", "public", "nrcs-logo-source.png"),
    path.join(process.cwd(), "..", "client", "public", "nrcs-logo-source.png"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        logoBuffer = fs.readFileSync(p);
        return logoBuffer;
      }
    } catch {
      // ignore
    }
  }
  logoBuffer = null;
  return null;
}

export async function renderBranchSummaryPdf(data: BranchSummaryReport): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const margin = 36;
    let y = 24;

    const buf = getLogoBuffer();
    if (buf) {
      try {
        doc.image(buf, margin, y, { width: 40 });
      } catch {
        // skip broken image
      }
    }

    const textLeft = margin + (buf ? 48 : 0);
    doc.fillColor("#111827").fontSize(11).text("Nigerian Red Cross Society — Branch Summary", textLeft, y + 4, {
      width: pageW - margin * 2 - (buf ? 48 : 0),
    });
    y += 22;
    doc.fontSize(10).fillColor("#374151").text(data.branchName, textLeft, y, { width: pageW - margin * 2 - (buf ? 48 : 0) });
    y += 16;
    doc.fontSize(9).fillColor("#6B7280").text(`Report date: ${data.reportDate}`, textLeft, y);
    y += 28;

    doc.fillColor("#111827").fontSize(11).text("1. Asset summary", margin, y);
    y += 14;
    const cat = data.assetsByCategory;
    const rowH = 14;
    const colCat = margin;
    const colCnt = margin + 200;
    const colVal = margin + 260;
    const colDep = margin + 340;
    doc.fontSize(8).fillColor("#6B7280");
    doc.text("Category", colCat, y);
    doc.text("Count", colCnt, y);
    doc.text("Total value", colVal, y);
    doc.text("Depreciated", colDep, y);
    y += rowH;
    doc.fillColor("#111827");
    let sumVal = 0;
    let sumDep = 0;
    const maxCatRows = 8;
    for (let i = 0; i < Math.min(cat.length, maxCatRows); i++) {
      const r = cat[i]!;
      sumVal += r.totalValue;
      sumDep += r.depreciatedValue;
      doc.fontSize(8).text(r.category.slice(0, 36), colCat, y, { width: 190 });
      doc.text(String(r.count), colCnt, y);
      doc.text(r.totalValue.toFixed(2), colVal, y);
      doc.text(r.depreciatedValue.toFixed(2), colDep, y);
      y += rowH;
    }
    if (cat.length > maxCatRows) {
      doc.fillColor("#6B7280").fontSize(8).text(`+${cat.length - maxCatRows} more categories`, colCat, y);
      y += rowH;
    }
    doc.fontSize(8).fillColor("#111827");
    doc.text("Totals / assets", colCat, y);
    doc.text(String(data.assetCount), colCnt, y);
    doc.text(sumVal.toFixed(2), colVal, y);
    doc.text(sumDep.toFixed(2), colDep, y);
    y += 22;

    doc.fillColor("#111827").fontSize(11).text("2. Stock readiness", margin, y);
    y += 14;
    const { adequateCount, totalFacilities, percentage } = data.stockReadiness;
    const barX = margin;
    const barW = pageW - margin * 2;
    const barH = 12;
    doc.rect(barX, y, barW, barH).stroke("#D1D5DB");
    const fillW = totalFacilities > 0 ? (adequateCount / totalFacilities) * barW : 0;
    doc.rect(barX, y, Math.max(0, Math.min(fillW, barW)), barH).fill("#16A34A");
    doc.fillColor("#111827").fontSize(8).text(`${percentage}% adequate`, barX, y + barH + 4);
    doc.text(`${adequateCount} / ${totalFacilities} stock lines`, barX + 120, y + barH + 4);
    y += barH + 28;

    doc.fontSize(11).text("3. Pending requisitions", margin, y);
    y += 14;
    const pr = data.pendingRequisitions;
    const boxW = (barW - 16) / 3;
    const drawBox = (ix: number, title: string, val: string) => {
      const x = margin + ix * (boxW + 8);
      doc.rect(x, y, boxW, 36).stroke("#E5E7EB");
      doc.fontSize(7).fillColor("#6B7280").text(title, x + 6, y + 6, { width: boxW - 12 });
      doc.fontSize(11).fillColor("#111827").text(val, x + 6, y + 18, { width: boxW - 12 });
    };
    drawBox(0, "Total", String(pr.total));
    drawBox(1, "Urgent", String(pr.urgent));
    drawBox(2, "Oldest (days)", String(pr.oldestDays));
    y += 44;

    doc.fontSize(11).text("4. Low stock (top items)", margin, y);
    y += 14;
    doc.fontSize(8).fillColor("#6B7280");
    doc.text("Item", margin, y);
    doc.text("On hand", margin + 260, y);
    doc.text("Reorder", margin + 320, y);
    y += rowH;
    doc.fillColor("#111827");
    const low = data.lowStockItems;
    for (let i = 0; i < low.length; i++) {
      const L = low[i]!;
      doc.fontSize(8).text(L.itemName.slice(0, 42), margin, y, { width: 250 });
      doc.text(String(L.currentStock), margin + 260, y);
      doc.text(String(L.reorderPoint), margin + 320, y);
      y += rowH;
      if (y > doc.page.height - 120) break;
    }
    if (data.lowStockMoreCount > 0) {
      doc.fillColor("#6B7280").fontSize(8).text(`+${data.lowStockMoreCount} more low-stock items`, margin, y);
      y += rowH;
    }
    y += 6;

    if (y < doc.page.height - 100) {
      doc.fillColor("#111827").fontSize(11).text("5. Recent activity", margin, y);
      y += 12;
      for (const a of data.recentActivity) {
        doc.fontSize(7).fillColor("#374151").text(`${a.date} · ${a.action}`, margin, y, { width: barW - 80, continued: true });
        doc.fillColor("#9CA3AF").text(`  (${a.user})`, { continued: false });
        y += 11;
        if (y > doc.page.height - 48) break;
      }
    }

    doc.end();
  });
}
