import fs from "node:fs";
import path from "node:path";
import type { AssetValuationReport } from "./db";

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
      /* ignore */
    }
  }
  logoBuffer = null;
  return null;
}

function ngn(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

const FOOTER =
  "Confidential — Nigerian Red Cross Society — Prepared by Ivano Technologies Ltd";

/** Executive PDF for board / donor reporting (serverless-safe pdfkit). */
export async function buildAssetValuationExecutivePdf(report: AssetValuationReport): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({
    size: "A4",
    margin: 44,
    bufferPages: true,
    autoFirstPage: true,
  });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const margin = 44;
    const pageW = doc.page.width;
    const contentW = pageW - margin * 2;
    let y = margin;

    const ensureSpace = (needed: number) => {
      if (y + needed > doc.page.height - margin - 28) {
        doc.addPage();
        y = margin;
      }
    };

    const paintFooter = () => {
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(7)
          .fillColor("#6B7280")
          .text(FOOTER, margin, doc.page.height - 32, { width: contentW, align: "center" });
      }
    };

    const logo = getLogoBuffer();
    if (logo) {
      try {
        doc.image(logo, margin, y, { width: 42 });
      } catch {
        /* skip */
      }
    }

    const textX = margin + (logo ? 50 : 0);
    doc.fillColor("#1e3a8a").fontSize(14).text("Nigerian Red Cross Society", textX, y + 2, {
      width: contentW - (logo ? 50 : 0),
    });
    y += 18;
    doc.fillColor("#dc2626").fontSize(11).text("Enterprise Asset Management", textX, y, {
      width: contentW - (logo ? 50 : 0),
    });
    y += 22;
    doc.fillColor("#000").fontSize(13).text("Asset Valuation Summary — May 2026", margin, y, {
      width: contentW,
      underline: true,
    });
    y += 26;

    doc.fontSize(9).fillColor("#444").text(`Generated ${new Date().toISOString().slice(0, 10)}`, margin, y);
    y += 18;
    doc.fillColor("#000");

    ensureSpace(70);
    doc.fontSize(11).text("Summary", margin, y);
    y += 16;
    doc.fontSize(9);
    const summaryLines = [
      `Total certified property value: ${ngn(report.totalCertifiedPropertyNgn)}`,
      `Total movable asset value: ${ngn(report.totalMovableAcquisitionNgn)}`,
      `Combined total asset value: ${ngn(report.combinedTotalNgn)}`,
      `Properties valued: ${report.valuationRowCount} register entries across ${report.distinctSitesWithValuation} sites (${report.totalFacilityCount} facilities total; ${report.activeBranchCount} active branch offices)`,
      `Branch offices pending formal valuation: ${report.pendingBranchValuation.length}`,
    ];
    for (const line of summaryLines) {
      ensureSpace(14);
      doc.text(line, margin, y, { width: contentW });
      y += 14;
    }
    y += 10;

    ensureSpace(24);
    doc.fontSize(11).text("Property valuation register", margin, y);
    y += 14;
    doc.fontSize(7).fillColor("#6B7280");
    const colCode = margin;
    const colName = margin + 52;
    const colLand = margin + 200;
    const colMarket = margin + 260;
    const colCert = margin + 330;
    doc.text("Code", colCode, y);
    doc.text("Facility", colName, y, { width: 140 });
    doc.text("sqm", colLand, y);
    doc.text("Market", colMarket, y);
    doc.text("Certified", colCert, y);
    y += 12;
    doc.fillColor("#000").fontSize(7);

    const byState = new Map<string, typeof report.propertyRegister>();
    for (const row of report.propertyRegister) {
      const st = row.state ?? "—";
      if (!byState.has(st)) byState.set(st, []);
      byState.get(st)!.push(row);
    }
    const states = Array.from(byState.keys()).sort((a, b) => a.localeCompare(b));

    for (const state of states) {
      ensureSpace(16);
      doc.fontSize(8).fillColor("#374151").text(state, margin, y, { width: contentW });
      y += 11;
      doc.fontSize(7).fillColor("#000");
      for (const row of byState.get(state) ?? []) {
        ensureSpace(12);
        doc.text(row.facilityCode ?? "—", colCode, y, { width: 48 });
        doc.text(row.facilityName.slice(0, 42), colName, y, { width: 140 });
        doc.text(
          row.landAreaSqm != null ? Number(row.landAreaSqm).toLocaleString("en-NG", { maximumFractionDigits: 1 }) : "—",
          colLand,
          y
        );
        doc.text(ngn(row.marketValueNgn), colMarket, y, { width: 64 });
        doc.text(ngn(row.certifiedValueNgn), colCert, y, { width: 72 });
        y += 11;
      }
      y += 4;
    }

    y += 8;
    ensureSpace(24);
    doc.fontSize(11).fillColor("#000").text("Movable assets by category (excl. LA / LB)", margin, y);
    y += 14;
    doc.fontSize(7);
    for (const row of report.movableByCategory) {
      ensureSpace(12);
      doc.text(
        `${row.categoryName}: ${row.count} items · ${ngn(row.totalAcquisitionNgn)} (depreciated ${ngn(row.totalDepreciatedNgn)})`,
        margin,
        y,
        { width: contentW }
      );
      y += 11;
    }

    y += 10;
    ensureSpace(24);
    doc.fontSize(11).text("Active branch offices pending valuation", margin, y);
    y += 14;
    doc.fontSize(7);
    if (report.pendingBranchValuation.length === 0) {
      doc.text("None — all active branches have a property valuation row.", margin, y, { width: contentW });
    } else {
      for (const p of report.pendingBranchValuation) {
        ensureSpace(11);
        doc.text(
          `• ${p.facilityCode ?? "—"} — ${p.facilityName} (${p.state ?? "—"})`,
          margin,
          y,
          { width: contentW }
        );
        y += 10;
      }
    }

    paintFooter();
    doc.end();
  });
}
