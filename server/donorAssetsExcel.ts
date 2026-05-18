import ExcelJS from "exceljs";
import type { getDonorAssetsReport } from "./donorAssetsDb";

type Report = Awaited<ReturnType<typeof getDonorAssetsReport>>;

export async function buildDonorAssetsWorkbook(report: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet("Donor breakdown");
  summary.addRow(["Donor", "Assets", "Acquisition (₦)", "Book value (₦)", "Categories"]);
  for (const d of report.donors) {
    summary.addRow([
      d.donor,
      d.assetCount,
      d.totalAcquisitionNgn,
      d.totalBookNgn,
      d.categories.join(", "),
    ]);
  }

  const detail = wb.addWorksheet("Asset detail");
  detail.addRow([
    "Donor",
    "Asset code",
    "Description",
    "Category",
    "Facility",
    "Year acquired",
    "Acquisition (₦)",
    "Book value (₦)",
    "Condition",
  ]);
  for (const a of report.allAssets) {
    detail.addRow([
      a.donor,
      a.assetCode ?? "",
      a.name,
      a.categoryName ?? "",
      a.facilityName ?? "",
      a.yearAcquired ?? "",
      a.acquisitionValueNgn,
      a.bookValueNgn,
      a.condition ?? "",
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
