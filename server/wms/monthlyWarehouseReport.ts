import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { commodityTrackingNumbers, donors, inventoryCatalogue, sites, stockCards, stockMovements, waybills } from "../../drizzle/schema";

type Db = any;

export type MonthlyWarehouseReportRow = {
  sn: number;
  product: string;
  unitAndWeight: string;
  openingBalance: number;
  inbound: number;
  outDistributions: number;
  outBranches: number;
  outOthers: number;
  lossAndDamaged: number;
  closingBalance: number;
  comments: string;
};

export function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);
  return { startIso, endIso };
}

export async function buildMonthlyWarehouseReport(db: Db, params: {
  warehouseId: number;
  year: number;
  month: number;
}): Promise<MonthlyWarehouseReportRow[]> {
  const { startIso, endIso } = monthBounds(params.year, params.month);

  const cards = await db
    .select({
      stockCardId: stockCards.id,
      product: inventoryCatalogue.name,
      itemCode: inventoryCatalogue.itemCode,
      unit: stockCards.measureUnit,
      donorCode: donors.code,
      ctnCode: commodityTrackingNumbers.ctnCode,
    })
    .from(stockCards)
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
    .innerJoin(donors, eq(commodityTrackingNumbers.donorId, donors.id))
    .where(eq(stockCards.locationId, params.warehouseId))
    .orderBy(asc(inventoryCatalogue.name), asc(commodityTrackingNumbers.ctnCode));

  const rows: MonthlyWarehouseReportRow[] = [];
  for (const [idx, card] of cards.entries()) {
    const [openingAgg] = await db
      .select({
        net: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
      })
      .from(stockMovements)
      .where(and(eq(stockMovements.stockCardId, card.stockCardId), sql`${stockMovements.date} < ${startIso}`));

    const [inboundAgg] = await db
      .select({
        total: sql<number>`coalesce(sum(${stockMovements.quantityIn}), 0)`.mapWith(Number),
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.stockCardId, card.stockCardId),
          gte(stockMovements.date, startIso),
          lte(stockMovements.date, endIso),
          sql`${stockMovements.sourceType} in ('grn', 'transfer_in')`
        )
      );

    const [distributionAgg] = await db
      .select({
        total: sql<number>`coalesce(sum(${stockMovements.quantityOut}), 0)`.mapWith(Number),
      })
      .from(stockMovements)
      .innerJoin(waybills, eq(stockMovements.documentRef, waybills.wbNumber))
      .where(
        and(
          eq(stockMovements.stockCardId, card.stockCardId),
          gte(stockMovements.date, startIso),
          lte(stockMovements.date, endIso),
          eq(stockMovements.sourceType, "waybill"),
          sql`${waybills.destinationType} in ('distribution_point', 'beneficiary')`
        )
      );

    const [branchesAgg] = await db
      .select({
        total: sql<number>`coalesce(sum(${stockMovements.quantityOut}), 0)`.mapWith(Number),
      })
      .from(stockMovements)
      .innerJoin(waybills, eq(stockMovements.documentRef, waybills.wbNumber))
      .where(
        and(
          eq(stockMovements.stockCardId, card.stockCardId),
          gte(stockMovements.date, startIso),
          lte(stockMovements.date, endIso),
          eq(stockMovements.sourceType, "waybill"),
          eq(waybills.destinationType, "branch_store")
        )
      );

    const [othersAgg] = await db
      .select({
        total: sql<number>`coalesce(sum(${stockMovements.quantityOut}), 0)`.mapWith(Number),
      })
      .from(stockMovements)
      .innerJoin(waybills, eq(stockMovements.documentRef, waybills.wbNumber))
      .where(
        and(
          eq(stockMovements.stockCardId, card.stockCardId),
          gte(stockMovements.date, startIso),
          lte(stockMovements.date, endIso),
          eq(stockMovements.sourceType, "waybill"),
          eq(waybills.destinationType, "other")
        )
      );

    const [lossAgg] = await db
      .select({
        total: sql<number>`coalesce(sum(${stockMovements.quantityOut}), 0)`.mapWith(Number),
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.stockCardId, card.stockCardId),
          gte(stockMovements.date, startIso),
          lte(stockMovements.date, endIso),
          sql`(${stockMovements.sourceType} = 'expiry' or (${stockMovements.sourceType} = 'adjustment' and coalesce(${stockMovements.remarks}, '') ilike any(array['%loss%', '%damaged%'])))`
        )
      );

    const [earliestGrn] = await db
      .select({ documentRef: stockMovements.documentRef })
      .from(stockMovements)
      .where(and(eq(stockMovements.stockCardId, card.stockCardId), eq(stockMovements.sourceType, "grn")))
      .orderBy(asc(stockMovements.date), asc(stockMovements.id))
      .limit(1);

    const openingBalance = Number(openingAgg?.net ?? 0);
    const inbound = Number(inboundAgg?.total ?? 0);
    const outDistributions = Number(distributionAgg?.total ?? 0);
    const outBranches = Number(branchesAgg?.total ?? 0);
    const outOthers = Number(othersAgg?.total ?? 0);
    const lossAndDamaged = Number(lossAgg?.total ?? 0);
    const closingBalance = openingBalance + inbound - (outDistributions + outBranches + outOthers + lossAndDamaged);
    rows.push({
      sn: idx + 1,
      product: `${card.product} (${card.itemCode})`,
      unitAndWeight: card.unit || "—",
      openingBalance,
      inbound,
      outDistributions,
      outBranches,
      outOthers,
      lossAndDamaged,
      closingBalance,
      comments: `${card.donorCode} / ${earliestGrn?.documentRef ?? "—"}`,
    });
  }

  return rows;
}

export function monthlyReportColumns() {
  return [
    { header: "SN", key: "sn", width: 8 },
    { header: "Product", key: "product", width: 30 },
    { header: "Unit & weight", key: "unitAndWeight", width: 16 },
    { header: "Opening Balance (a)", key: "openingBalance", width: 16 },
    { header: "IN (b)", key: "inbound", width: 12 },
    { header: "OUT TO: Distributions (c)", key: "outDistributions", width: 18 },
    { header: "OUT TO: Branches store (d)", key: "outBranches", width: 18 },
    { header: "OUT TO: Others (e)", key: "outOthers", width: 16 },
    { header: "Loss/Damaged (f)", key: "lossAndDamaged", width: 16 },
    { header: "Closing Balance", key: "closingBalance", width: 16 },
    { header: "Comments", key: "comments", width: 24 },
  ];
}

export async function monthlyReportHeader(db: Db, warehouseId: number, year: number, month: number) {
  const [warehouse] = await db.select({ name: sites.name }).from(sites).where(eq(sites.id, warehouseId)).limit(1);
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return {
    warehouseName: warehouse?.name ?? "Unknown Warehouse",
    title: "NIGERIAN RED CROSS SOCIETY",
    subtitle: "WAREHOUSE — MONTHLY REPORT",
    monthLabel: `${monthName} ${year}`,
  };
}

