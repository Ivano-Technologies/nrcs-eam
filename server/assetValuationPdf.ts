import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AssetValuationReport } from "./db";

const FOOTER =
  "Confidential — Nigerian Red Cross Society — Prepared by Ivano Technologies Ltd";
const NRCS_RED = rgb(200 / 255, 16 / 255, 46 / 255);
const WHITE = rgb(1, 1, 1);
const MUTED = rgb(0.42, 0.42, 0.42);
const BODY = rgb(0.12, 0.12, 0.12);
const SECTION = rgb(0.22, 0.22, 0.22);

function ngn(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export async function buildAssetValuationExecutivePdf(report: AssetValuationReport): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595;
  const pageH = 842;
  const margin = 44;
  const contentW = pageW - margin * 2;
  const lineH = 12;
  const headerH = 72;

  let page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - margin - headerH;

  const footerWidth = font.widthOfTextAtSize(FOOTER, 7);

  const drawFooter = (p: typeof page) => {
    p.drawText(FOOTER, {
      x: (pageW - footerWidth) / 2,
      y: 24,
      size: 7,
      font,
      color: MUTED,
    });
  };

  const paintHeader = (p: typeof page) => {
    p.drawRectangle({ x: 0, y: pageH - headerH, width: pageW, height: headerH, color: NRCS_RED });
    p.drawText("Nigerian Red Cross Society", {
      x: margin,
      y: pageH - 28,
      size: 10,
      font,
      color: WHITE,
    });
    p.drawText("Asset Valuation Summary — May 2026", {
      x: margin,
      y: pageH - 48,
      size: 14,
      font: bold,
      color: WHITE,
    });
  };

  const newPage = () => {
    page = pdfDoc.addPage([pageW, pageH]);
    paintHeader(page);
    y = pageH - margin - headerH;
  };

  const ensure = (needed: number) => {
    if (y - needed < margin + 28) newPage();
  };

  const section = (title: string) => {
    ensure(lineH * 2);
    page.drawText(title, { x: margin, y, size: 11, font: bold, color: SECTION });
    y -= lineH + 4;
  };

  const line = (text: string, size = 9) => {
    ensure(lineH);
    page.drawText(text, { x: margin, y, size, font, color: BODY, maxWidth: contentW });
    y -= lineH;
  };

  paintHeader(page);
  line(`Generated ${new Date().toISOString().slice(0, 10)}`, 8);
  y -= 6;

  section("Summary");
  line(`Total certified property value: ${ngn(report.totalCertifiedPropertyNgn)}`);
  line(`Total movable asset value: ${ngn(report.totalMovableAcquisitionNgn)}`);
  line(`Combined total asset value: ${ngn(report.combinedTotalNgn)}`);
  line(`Properties valued: ${report.valuationRowCount}`);
  y -= 8;

  section("Property valuation register");
  const colCode = margin;
  const colName = margin + 52;
  const colLand = margin + 200;
  const colMarket = margin + 258;
  const colCert = margin + 328;

  ensure(lineH);
  page.drawText("Code", { x: colCode, y, size: 7, font: bold, color: MUTED });
  page.drawText("Facility", { x: colName, y, size: 7, font: bold, color: MUTED });
  page.drawText("Land (sqm)", { x: colLand, y, size: 7, font: bold, color: MUTED });
  page.drawText("Market (₦)", { x: colMarket, y, size: 7, font: bold, color: MUTED });
  page.drawText("Certified (₦)", { x: colCert, y, size: 7, font: bold, color: MUTED });
  y -= lineH;

  const byState = new Map<string, typeof report.propertyRegister>();
  for (const row of report.propertyRegister) {
    const st = row.state ?? "—";
    if (!byState.has(st)) byState.set(st, []);
    byState.get(st)!.push(row);
  }

  for (const state of Array.from(byState.keys()).sort((a, b) => a.localeCompare(b))) {
    ensure(lineH * 2);
    page.drawText(state, { x: margin, y, size: 8, font: bold, color: MUTED });
    y -= lineH;
    for (const row of byState.get(state) ?? []) {
      ensure(lineH);
      page.drawText(row.facilityCode ?? "—", { x: colCode, y, size: 7, font, color: BODY });
      page.drawText(row.facilityName.slice(0, 36), { x: colName, y, size: 7, font, color: BODY });
      const land =
        row.landAreaSqm != null
          ? Number(row.landAreaSqm).toLocaleString("en-NG", { maximumFractionDigits: 1 })
          : "—";
      page.drawText(land, { x: colLand, y, size: 7, font, color: BODY });
      page.drawText(ngn(row.marketValueNgn), { x: colMarket, y, size: 7, font, color: BODY });
      page.drawText(ngn(row.certifiedValueNgn), { x: colCert, y, size: 7, font, color: BODY });
      y -= lineH;
    }
    y -= 4;
  }

  y -= 6;
  section("Movable asset breakdown by category");
  for (const row of report.movableByCategory) {
    line(
      `${row.categoryName}: ${row.count} · ${ngn(row.totalAcquisitionNgn)} (depreciated ${ngn(row.totalDepreciatedNgn)})`,
      8
    );
  }

  y -= 6;
  section("Pending branches");
  if (report.pendingBranchValuation.length === 0) {
    line("None — all active branches have a property valuation on the branch or a related facility.", 8);
  } else {
    for (const p of report.pendingBranchValuation) {
      line(`• ${p.facilityCode ?? "—"} — ${p.facilityName} (${p.state ?? "—"})`, 8);
    }
  }

  for (const p of pdfDoc.getPages()) {
    drawFooter(p);
  }

  return Buffer.from(await pdfDoc.save());
}
