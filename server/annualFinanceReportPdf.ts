import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { getAnnualFinanceReportData } from "./financeModulesDb";

type ReportData = Awaited<ReturnType<typeof getAnnualFinanceReportData>>;

const FOOTER =
  "Confidential — Nigerian Red Cross Society — Prepared by Ivano Technologies Ltd";
const NRCS_RED = rgb(200 / 255, 16 / 255, 46 / 255);

function ngn(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export async function buildAnnualFinanceReportPdf(data: ReportData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([595, 842]);
  const margin = 48;
  let y = 800;
  const lineH = 14;
  const pageH = 842;

  const ensure = (needed: number) => {
    if (y - needed < margin + 24) {
      page = pdfDoc.addPage([595, 842]);
      y = 800;
    }
  };

  const drawFooter = (p: typeof page) => {
    p.drawText(FOOTER, {
      x: margin,
      y: 28,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  };

  page.drawRectangle({
    x: 0,
    y: pageH - 72,
    width: 595,
    height: 72,
    color: NRCS_RED,
  });
  page.drawText(`Annual Finance Report — ${data.year}`, {
    x: margin,
    y: pageH - 48,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Nigerian Red Cross Society — Enterprise Asset Management", {
    x: margin,
    y: pageH - 66,
    size: 10,
    font,
    color: rgb(1, 1, 1),
  });
  y = pageH - 96;

  const section = (title: string) => {
    ensure(lineH * 3);
    page.drawText(title, { x: margin, y, size: 12, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= lineH + 4;
  };

  const line = (text: string, size = 9) => {
    ensure(lineH);
    page.drawText(text, { x: margin, y, size, font, color: rgb(0.15, 0.15, 0.15) });
    y -= lineH;
  };

  section("1. Asset Valuation Summary");
  line(`Total certified property value: ${ngn(data.valuation.totalCertifiedPropertyNgn)}`);
  line(`Total movable asset value: ${ngn(data.valuation.totalMovableAcquisitionNgn)}`);
  line(`Combined total asset value: ${ngn(data.valuation.combinedTotalNgn)}`);
  y -= 8;

  section("2. Depreciation Summary");
  line(`Gross asset value: ${ngn(data.depreciation.totalGrossAssetValue)}`);
  line(`Accumulated depreciation: ${ngn(data.depreciation.totalAccumulatedDepreciation)}`);
  line(`Net book value: ${ngn(data.depreciation.totalNetBookValue)}`);
  line(`Assets fully depreciated: ${data.depreciation.assetsFullyDepreciated}`);
  y -= 8;

  section("3. Budget vs Actual");
  for (const b of data.budgetVsActual.slice(0, 40)) {
    line(
      `${b.siteName}: budget ${ngn(b.budget)}, spend ${ngn(b.spend)}, ${b.percentUsed}% used (${b.status})`
    );
  }
  if (data.budgetVsActual.length > 40) {
    line(`… and ${data.budgetVsActual.length - 40} more branches`);
  }
  y -= 8;

  section("4. Maintenance Cost Summary");
  line(`Total maintenance spend: ${ngn(data.maintenance.totalSpend)}`);
  line("Top assets by maintenance cost:");
  for (const t of data.maintenance.topAssets) {
    line(`  • ${t.assetCode ?? "—"} ${t.assetName}: ${ngn(t.total)}`, 8);
  }
  y -= 8;

  section("5. Insurance Summary");
  line(`Total insured value: ${ngn(data.insurance.totalInsuredValue)}`);
  line(`Total annual premiums: ${ngn(data.insurance.totalAnnualPremiums)}`);
  line(`Policies expiring in ${data.year}: ${data.insurance.policiesExpiringInYear}`);
  line(`Active policies: ${data.insurance.activeCount}`);

  const pages = pdfDoc.getPages();
  for (const p of pages) {
    drawFooter(p);
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
