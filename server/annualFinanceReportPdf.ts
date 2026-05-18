import { rgb } from "pdf-lib";
import type { getAnnualFinanceReportData } from "./financeModulesDb";
import { createNrcsPdfLayout, finalizePdfLayout, type PdfLayout } from "./lib/nrcsPdfLayout";

type ReportData = Awaited<ReturnType<typeof getAnnualFinanceReportData>>;

const BODY = rgb(0.12, 0.12, 0.12);
const SECTION = rgb(0.22, 0.22, 0.22);

function ngn(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function section(layout: PdfLayout, title: string) {
  layout.ensure(layout.lineH * 2);
  layout.page.drawText(title, {
    x: layout.margin,
    y: layout.y,
    size: 11,
    font: layout.bold,
    color: SECTION,
  });
  layout.y -= layout.lineH + 4;
}

function line(layout: PdfLayout, text: string, size = 9) {
  layout.ensure(layout.lineH);
  layout.page.drawText(layout.truncate(text, 100), {
    x: layout.margin,
    y: layout.y,
    size,
    font: layout.font,
    color: BODY,
    maxWidth: layout.contentW,
  });
  layout.y -= layout.lineH;
}

export async function buildAnnualFinanceReportPdf(data: ReportData): Promise<Buffer> {
  const layout = await createNrcsPdfLayout({
    title: `Annual Finance Report — ${data.year}`,
    subtitle: "Nigerian Red Cross Society — Enterprise Asset Management",
  });

  layout.y -= 6;

  section(layout, "1. Asset Valuation Summary");
  line(layout, `Total certified property value: ${ngn(data.valuation.totalCertifiedPropertyNgn)}`);
  line(layout, `Total movable asset value: ${ngn(data.valuation.totalMovableAcquisitionNgn)}`);
  line(layout, `Combined total asset value: ${ngn(data.valuation.combinedTotalNgn)}`);
  layout.y -= 8;

  section(layout, "2. Depreciation Summary");
  line(layout, `Gross asset value: ${ngn(data.depreciation.totalGrossAssetValue)}`);
  line(layout, `Accumulated depreciation: ${ngn(data.depreciation.totalAccumulatedDepreciation)}`);
  line(layout, `Net book value: ${ngn(data.depreciation.totalNetBookValue)}`);
  line(layout, `Assets fully depreciated: ${data.depreciation.assetsFullyDepreciated}`);
  layout.y -= 8;

  section(layout, "3. Budget vs Actual");
  for (const b of data.budgetVsActual) {
    line(
      layout,
      `${b.siteName}: budget ${ngn(b.budget)}, spend ${ngn(b.spend)}, ${b.percentUsed}% used (${b.status})`
    );
  }
  layout.y -= 8;

  section(layout, "4. Maintenance Cost Summary");
  line(layout, `Total maintenance spend: ${ngn(data.maintenance.totalSpend)}`);
  line(layout, "Top assets by maintenance cost:");
  for (const t of data.maintenance.topAssets) {
    line(layout, `  • ${t.assetCode ?? "—"} ${t.assetName}: ${ngn(t.total)}`, 8);
  }
  layout.y -= 8;

  section(layout, "5. Insurance Summary");
  line(layout, `Total insured value: ${ngn(data.insurance.totalInsuredValue)}`);
  line(layout, `Total annual premiums: ${ngn(data.insurance.totalAnnualPremiums)}`);
  line(layout, `Policies expiring in ${data.year}: ${data.insurance.policiesExpiringInYear}`);
  line(layout, `Active policies: ${data.insurance.activeCount}`);

  return finalizePdfLayout(layout);
}
