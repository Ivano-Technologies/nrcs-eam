import { rgb } from "pdf-lib";
import type { AssetValuationReport } from "./db";
import {
  createNrcsPdfLayout,
  finalizePdfLayout,
  type PdfLayout,
} from "./lib/nrcsPdfLayout";

const MUTED = rgb(0.42, 0.42, 0.42);
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
  layout.page.drawText(text, {
    x: layout.margin,
    y: layout.y,
    size,
    font: layout.font,
    color: BODY,
    maxWidth: layout.contentW,
  });
  layout.y -= layout.lineH;
}

export async function buildAssetValuationExecutivePdf(report: AssetValuationReport): Promise<Buffer> {
  const layout = await createNrcsPdfLayout({
    title: "Asset Valuation Summary — May 2026",
  });

  line(layout, `Generated ${new Date().toISOString().slice(0, 10)}`, 8);
  layout.y -= 6;

  section(layout, "Summary");
  line(layout, `Total certified property value: ${ngn(report.totalCertifiedPropertyNgn)}`);
  line(layout, `Total movable asset value: ${ngn(report.totalMovableAcquisitionNgn)}`);
  line(layout, `Combined total asset value: ${ngn(report.combinedTotalNgn)}`);
  line(
    layout,
    `Properties valued: ${report.valuationRowCount} register entries · ${report.distinctSitesWithValuation} sites`
  );
  line(
    layout,
    `Branch offices pending valuation: ${report.pendingBranchValuation.length} of ${report.activeBranchCount} active branches`
  );
  layout.y -= 8;

  section(layout, "Property valuation register");
  const colCode = layout.margin;
  const colName = layout.margin + 52;
  const colLand = layout.margin + 200;
  const colMarket = layout.margin + 258;
  const colCert = layout.margin + 328;

  layout.ensure(layout.lineH);
  layout.page.drawText("Code", { x: colCode, y: layout.y, size: 7, font: layout.bold, color: MUTED });
  layout.page.drawText("Facility", { x: colName, y: layout.y, size: 7, font: layout.bold, color: MUTED });
  layout.page.drawText("Land (sqm)", { x: colLand, y: layout.y, size: 7, font: layout.bold, color: MUTED });
  layout.page.drawText("Market (₦)", { x: colMarket, y: layout.y, size: 7, font: layout.bold, color: MUTED });
  layout.page.drawText("Certified (₦)", { x: colCert, y: layout.y, size: 7, font: layout.bold, color: MUTED });
  layout.y -= layout.lineH;

  const byState = new Map<string, typeof report.propertyRegister>();
  for (const row of report.propertyRegister) {
    const st = row.state ?? "—";
    if (!byState.has(st)) byState.set(st, []);
    byState.get(st)!.push(row);
  }

  for (const state of Array.from(byState.keys()).sort((a, b) => a.localeCompare(b))) {
    layout.ensure(layout.lineH * 2);
    layout.page.drawText(state, {
      x: layout.margin,
      y: layout.y,
      size: 8,
      font: layout.bold,
      color: MUTED,
    });
    layout.y -= layout.lineH;
    for (const row of byState.get(state) ?? []) {
      layout.ensure(layout.lineH);
      layout.page.drawText(layout.truncate(row.facilityCode ?? "—", 10), {
        x: colCode,
        y: layout.y,
        size: 7,
        font: layout.font,
        color: BODY,
      });
      layout.page.drawText(layout.truncate(row.facilityName, 28), {
        x: colName,
        y: layout.y,
        size: 7,
        font: layout.font,
        color: BODY,
      });
      const land =
        row.landAreaSqm != null
          ? Number(row.landAreaSqm).toLocaleString("en-NG", { maximumFractionDigits: 1 })
          : "—";
      layout.page.drawText(layout.truncate(land, 12), {
        x: colLand,
        y: layout.y,
        size: 7,
        font: layout.font,
        color: BODY,
      });
      layout.page.drawText(layout.truncate(ngn(row.marketValueNgn), 14), {
        x: colMarket,
        y: layout.y,
        size: 7,
        font: layout.font,
        color: BODY,
      });
      layout.page.drawText(layout.truncate(ngn(row.certifiedValueNgn), 14), {
        x: colCert,
        y: layout.y,
        size: 7,
        font: layout.font,
        color: BODY,
      });
      layout.y -= layout.lineH;
    }
    layout.y -= 4;
  }

  layout.y -= 6;
  section(layout, "Movable asset breakdown by category");
  if (report.movableByCategory.length === 0) {
    line(layout, "No movable asset values recorded (excluding land and buildings).", 8);
  } else {
    for (const row of report.movableByCategory) {
      line(
        layout,
        layout.truncate(
          `${row.categoryName}: ${row.count} items · ${ngn(row.totalAcquisitionNgn)} (depreciated ${ngn(row.totalDepreciatedNgn)})`,
          95
        ),
        8
      );
    }
  }

  layout.y -= 6;
  section(layout, "Pending branches");
  if (report.pendingBranchValuation.length === 0) {
    line(layout, "None — all active branches have a property valuation on the branch site.", 8);
  } else {
    for (const p of report.pendingBranchValuation) {
      line(
        layout,
        layout.truncate(
          `• ${p.facilityCode ?? "—"} — ${p.facilityName} (${p.state ?? "—"})`,
          90
        ),
        8
      );
    }
  }

  return finalizePdfLayout(layout);
}
