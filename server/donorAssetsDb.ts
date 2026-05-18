import { and, asc, eq, gte, lte, or, sql } from "drizzle-orm";
import { assetCategories, assets, sites } from "../drizzle/schema";
import * as db from "./db";

function num(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function isDonorFundedAcquisition(
  acquisitionMethod: string | null | undefined,
  remarks?: string | null
): boolean {
  const m = (acquisitionMethod ?? "").trim().toLowerCase();
  const r = (remarks ?? "").trim().toLowerCase();
  if (!m && !r) return false;
  if (m.includes("donated") || m.includes("donor")) return true;
  if (m.includes("icrc") || m.includes("ifrc")) return true;
  if (m.includes("brc") || m.includes("british red cross")) return true;
  if (m.includes("government") && m.includes("donat")) return true;
  if (r.includes("british red cross") || r.includes(" brc")) return true;
  return false;
}

export function normalizeDonorName(
  acquisitionMethod: string | null | undefined,
  acquisitionOtherDetail: string | null | undefined,
  remarks?: string | null
): string {
  const m = (acquisitionMethod ?? "").trim();
  const lower = m.toLowerCase();
  const other = (acquisitionOtherDetail ?? "").trim();
  const rem = (remarks ?? "").trim();

  if (lower.includes("icrc")) return "ICRC";
  if (lower.includes("ifrc")) return "IFRC";
  if (lower.includes("british red cross") || rem.toLowerCase().includes("british red cross") || rem.toLowerCase().includes("brc")) {
    return "British Red Cross";
  }
  if (lower.includes("government")) return "Government Donation";
  if (lower.includes("other donor")) return other || "Other Donor";
  if (lower.includes("donated")) return other || "Other Donor";
  return other || "Other Donor";
}

function bookValue(row: {
  depreciatedValue: string | null;
  currentDepreciatedValue: number | null;
  actualUnitValue: string | null;
  acquisitionCost: string | null;
}): number {
  if (row.depreciatedValue != null && String(row.depreciatedValue).trim() !== "") {
    return num(row.depreciatedValue);
  }
  if (row.currentDepreciatedValue != null) return row.currentDepreciatedValue;
  if (row.actualUnitValue != null && String(row.actualUnitValue).trim() !== "") {
    return num(row.actualUnitValue);
  }
  return num(row.acquisitionCost);
}

function acquisitionValue(row: {
  actualUnitValue: string | null;
  acquisitionCost: string | null;
}): number {
  if (row.actualUnitValue != null && String(row.actualUnitValue).trim() !== "") {
    return num(row.actualUnitValue);
  }
  return num(row.acquisitionCost);
}

export type DonorAssetRow = {
  id: number;
  assetCode: string | null;
  name: string;
  categoryName: string | null;
  facilityName: string | null;
  donor: string;
  yearAcquired: number | null;
  acquisitionValueNgn: number;
  bookValueNgn: number;
  condition: string | null;
};

export type DonorBreakdownRow = {
  donor: string;
  assetCount: number;
  totalAcquisitionNgn: number;
  totalBookNgn: number;
  categories: string[];
  assets: DonorAssetRow[];
};

export async function getDonorAssetsReport(filters?: {
  donor?: string;
  siteId?: number;
  categoryId?: number;
  yearFrom?: number;
  yearTo?: number;
}): Promise<{
  summary: {
    totalAssets: number;
    totalAcquisitionNgn: number;
    totalBookNgn: number;
    distinctDonors: number;
  };
  donors: DonorBreakdownRow[];
  allAssets: DonorAssetRow[];
}> {
  const database = await db.getDb();
  if (!database) {
    return {
      summary: { totalAssets: 0, totalAcquisitionNgn: 0, totalBookNgn: 0, distinctDonors: 0 },
      donors: [],
      allAssets: [],
    };
  }

  const conditions = [
    or(
      sql`lower(coalesce(${assets.acquisitionMethod}, '')) like '%donated%'`,
      sql`lower(coalesce(${assets.acquisitionMethod}, '')) like '%donor%'`,
      sql`lower(coalesce(${assets.acquisitionMethod}, '')) like '%icrc%'`,
      sql`lower(coalesce(${assets.acquisitionMethod}, '')) like '%ifrc%'`,
      sql`lower(coalesce(${assets.acquisitionMethod}, '')) like '%brc%'`,
      sql`lower(coalesce(${assets.remarksRegister}, '')) like '%british red cross%'`,
      sql`lower(coalesce(${assets.remarksRegister}, '')) like '% brc%'`
    ),
  ];

  if (filters?.siteId) conditions.push(eq(assets.siteId, filters.siteId));
  if (filters?.categoryId) conditions.push(eq(assets.categoryId, filters.categoryId));
  if (filters?.yearFrom != null) conditions.push(gte(assets.yearAcquiredRegister, filters.yearFrom));
  if (filters?.yearTo != null) conditions.push(lte(assets.yearAcquiredRegister, filters.yearTo));

  const rows = await database
    .select({
      id: assets.id,
      assetCode: assets.assetCode,
      name: assets.name,
      acquisitionMethod: assets.acquisitionMethod,
      acquisitionOtherDetail: assets.acquisitionOtherDetail,
      remarksRegister: assets.remarksRegister,
      yearAcquired: assets.yearAcquiredRegister,
      actualUnitValue: assets.actualUnitValue,
      acquisitionCost: assets.acquisitionCost,
      depreciatedValue: assets.depreciatedValue,
      currentDepreciatedValue: assets.currentDepreciatedValue,
      condition: assets.conditionRegister,
      categoryName: assetCategories.name,
      facilityName: sites.name,
    })
    .from(assets)
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(sites, eq(assets.siteId, sites.id))
    .where(and(...conditions))
    .orderBy(asc(assets.assetCode));

  const allAssets: DonorAssetRow[] = rows
    .filter((r) =>
      isDonorFundedAcquisition(r.acquisitionMethod, r.remarksRegister)
    )
    .map((r) => ({
      id: r.id,
      assetCode: r.assetCode,
      name: r.name,
      categoryName: r.categoryName,
      facilityName: r.facilityName,
      donor: normalizeDonorName(r.acquisitionMethod, r.acquisitionOtherDetail, r.remarksRegister),
      yearAcquired: r.yearAcquired,
      acquisitionValueNgn: acquisitionValue(r),
      bookValueNgn: bookValue(r),
      condition: r.condition,
    }))
    .filter((a) => !filters?.donor || a.donor === filters.donor);

  const byDonor = new Map<string, DonorAssetRow[]>();
  for (const a of allAssets) {
    if (!byDonor.has(a.donor)) byDonor.set(a.donor, []);
    byDonor.get(a.donor)!.push(a);
  }

  const donors: DonorBreakdownRow[] = Array.from(byDonor.entries())
    .map(([donor, assetsList]) => {
      const cats = new Set(assetsList.map((x) => x.categoryName).filter(Boolean) as string[]);
      return {
        donor,
        assetCount: assetsList.length,
        totalAcquisitionNgn: assetsList.reduce((s, x) => s + x.acquisitionValueNgn, 0),
        totalBookNgn: assetsList.reduce((s, x) => s + x.bookValueNgn, 0),
        categories: Array.from(cats).sort(),
        assets: assetsList,
      };
    })
    .sort((a, b) => a.donor.localeCompare(b.donor));

  return {
    summary: {
      totalAssets: allAssets.length,
      totalAcquisitionNgn: allAssets.reduce((s, x) => s + x.acquisitionValueNgn, 0),
      totalBookNgn: allAssets.reduce((s, x) => s + x.bookValueNgn, 0),
      distinctDonors: donors.length,
    },
    donors,
    allAssets,
  };
}
