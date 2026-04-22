/**
 * Applies IFRC catalogue audit to dev DB: migrate 0014+0015 (optional), update `item_category`,
 * migrate Asset-scoped seed rows to `assets` and remove from `inventory_catalogue`.
 *
 * Usage:
 *   pnpm exec tsx scripts/db/apply-ifrc-catalogue-audit.ts
 *   pnpm exec tsx scripts/db/apply-ifrc-catalogue-audit.ts --skip-migrate
 *
 * Idempotent for asset rows: if an IFRC asset `item_code` is already absent from `inventory_catalogue`,
 * the script skips creating a duplicate asset (assumes prior run).
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq, inArray, or, sql } from "drizzle-orm";
import {
  assetCategories,
  assets,
  binCards,
  commodityTrackingNumbers,
  goodsReceivedNoteLines,
  inventoryBatches,
  inventoryCatalogue,
  inventoryCountLines,
  inventoryKits,
  inventoryMovements,
  inventoryStock,
  kitCtnContributors,
  sites,
  stockCards,
  stockMovements,
  waybillLines,
} from "../../drizzle/schema";
import { getDb, resetDbConnection } from "../../server/db";
import { IFRC_CATALOGUE_SEED } from "../../shared/inventoryCatalogueSeed";
import {
  assertFullIfrcCoverage,
  IFRC_CATALOGUE_CLASSIFICATION,
  type WmsCatalogueClass,
} from "../../shared/ifrcCatalogueWmsClassification";

const REPORT_PATH = join(process.cwd(), "docs/planning/ifrc-catalogue-audit-execution-report.md");

const SEED_CODES = IFRC_CATALOGUE_SEED.map((x) => x.itemCode);

function runMigrations() {
  execSync("pnpm exec drizzle-kit migrate", { stdio: "inherit", cwd: process.cwd(), env: process.env });
}

async function deleteCatalogueCascadeForAsset(catalogueId: number, tx: any): Promise<void> {
  const db = tx;

  const stocks = await db
    .select({ id: inventoryStock.id })
    .from(inventoryStock)
    .where(eq(inventoryStock.catalogueId, catalogueId));
  const stockIds = stocks.map((s) => s.id);

  if (stockIds.length > 0) {
    await db.delete(inventoryCountLines).where(inArray(inventoryCountLines.stockId, stockIds));
  }

  await db.delete(inventoryMovements).where(eq(inventoryMovements.catalogueId, catalogueId));
  if (stockIds.length > 0) {
    await db.delete(inventoryMovements).where(inArray(inventoryMovements.stockId, stockIds));
  }

  if (stockIds.length > 0) {
    await db.delete(inventoryBatches).where(inArray(inventoryBatches.stockId, stockIds));
    await db.delete(inventoryStock).where(inArray(inventoryStock.id, stockIds));
  }

  const ctns = await db
    .select({ id: commodityTrackingNumbers.id })
    .from(commodityTrackingNumbers)
    .where(eq(commodityTrackingNumbers.itemId, catalogueId));
  const ctnIds = ctns.map((c) => c.id);

  if (ctnIds.length > 0) {
    await db.delete(kitCtnContributors).where(
      or(inArray(kitCtnContributors.kitCtnId, ctnIds), inArray(kitCtnContributors.componentCtnId, ctnIds))
    );

    const cards = await db
      .select({ id: stockCards.id })
      .from(stockCards)
      .where(inArray(stockCards.ctnId, ctnIds));
    const cardIds = cards.map((c) => c.id);

    if (cardIds.length > 0) {
      await db.delete(stockMovements).where(inArray(stockMovements.stockCardId, cardIds));
      await db.delete(binCards).where(inArray(binCards.stockCardId, cardIds));
      await db.delete(stockCards).where(inArray(stockCards.id, cardIds));
    }

    await db.delete(waybillLines).where(inArray(waybillLines.ctnId, ctnIds));
    await db.delete(goodsReceivedNoteLines).where(inArray(goodsReceivedNoteLines.ctnId, ctnIds));
    await db.delete(commodityTrackingNumbers).where(inArray(commodityTrackingNumbers.id, ctnIds));
  }

  await db.delete(inventoryKits).where(eq(inventoryKits.catalogueId, catalogueId));
  await db.delete(inventoryCatalogue).where(eq(inventoryCatalogue.id, catalogueId));
}

async function main() {
  const skipMigrate = process.argv.includes("--skip-migrate");
  assertFullIfrcCoverage(SEED_CODES);

  if (!skipMigrate) {
    runMigrations();
  }

  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL not set or database unavailable.");
    process.exit(1);
  }

  const [{ beforeCount }] = await db
    .select({ beforeCount: sql<number>`cast(count(*) as int)` })
    .from(inventoryCatalogue)
    .where(inArray(inventoryCatalogue.itemCode, SEED_CODES));

  const [hq] = await db.select({ id: sites.id }).from(sites).orderBy(sites.id).limit(1);
  if (!hq) {
    console.error("No site row — seed sites before running.");
    process.exit(1);
  }
  const siteId = hq.id;

  const categories = await db.select({ id: assetCategories.id, name: assetCategories.name }).from(assetCategories);
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

  let migratedAssets = 0;
  let skippedAssetsAlreadyDone = 0;
  const assetFailures: string[] = [];

  const assetCodes = SEED_CODES.filter((c) => IFRC_CATALOGUE_CLASSIFICATION[c].eamScope === "assets");

  await db.transaction(async (tx) => {
    for (const code of assetCodes) {
      const meta = IFRC_CATALOGUE_CLASSIFICATION[code];
      if (!meta.assetCategoryName) continue;
      const catId = categoryIdByName.get(meta.assetCategoryName);
      if (!catId) {
        throw new Error(`${code}: missing assetCategories "${meta.assetCategoryName}" — run db:seed first.`);
      }

      const [row] = await tx
        .select()
        .from(inventoryCatalogue)
        .where(eq(inventoryCatalogue.itemCode, code))
        .limit(1);

      if (!row) {
        skippedAssetsAlreadyDone += 1;
        continue;
      }

      const assetTag = `INV-MIG-${row.itemCode}`;
      const existingAsset = await tx.select({ id: assets.id }).from(assets).where(eq(assets.assetTag, assetTag)).limit(1);
      if (existingAsset.length > 0) {
        skippedAssetsAlreadyDone += 1;
        await deleteCatalogueCascadeForAsset(row.id, tx);
        continue;
      }

      try {
        await deleteCatalogueCascadeForAsset(row.id, tx);
        await tx.insert(assets).values({
          assetTag,
          name: row.name,
          description:
            row.description ??
            `Migrated from inventory_catalogue item_code=${row.itemCode}. ${meta.notes}`,
          categoryId: catId,
          siteId,
          status: "operational",
          registerStatus: "in_store",
          itemType: "asset",
        });
        migratedAssets += 1;
      } catch (e) {
        assetFailures.push(`${code}: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
      }
    }

    const wmsCodes = SEED_CODES.filter((c) => IFRC_CATALOGUE_CLASSIFICATION[c].eamScope === "wms");
    for (const code of wmsCodes) {
      const meta = IFRC_CATALOGUE_CLASSIFICATION[code];
      await tx
        .update(inventoryCatalogue)
        .set({ itemCategory: meta.itemCategory, updatedAt: new Date() })
        .where(eq(inventoryCatalogue.itemCode, code));
    }
  });

  const [{ afterWms }] = await db
    .select({ afterWms: sql<number>`cast(count(*) as int)` })
    .from(inventoryCatalogue)
    .where(inArray(inventoryCatalogue.itemCode, SEED_CODES));

  const reliefCount = await countByClass(db, "RELIEF_ITEM");
  const consumableCount = await countByClass(db, "CONSUMABLE");

  const report = buildReport({
    beforeCount: beforeCount ?? 0,
    afterWmsCount: afterWms ?? 0,
    migratedAssets,
    skippedAssetsAlreadyDone,
    removedNotInEam: 0,
    reliefCount,
    consumableCount,
    assetFailures,
  });

  console.log(report);
  writeFileSync(REPORT_PATH, report, "utf8");
  console.log(`\nWrote ${REPORT_PATH}`);

  if (assetFailures.length) {
    console.error("\nAsset migration failures.");
    process.exit(1);
  }

  await resetDbConnection();
}

async function countByClass(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  wmsClass: WmsCatalogueClass
): Promise<number> {
  const codes = SEED_CODES.filter((c) => IFRC_CATALOGUE_CLASSIFICATION[c].wmsClass === wmsClass);
  if (codes.length === 0) return 0;
  const [{ n }] = await db
    .select({ n: sql<number>`cast(count(*) as int)` })
    .from(inventoryCatalogue)
    .where(inArray(inventoryCatalogue.itemCode, codes));
  return n ?? 0;
}

function buildReport(p: {
  beforeCount: number;
  afterWmsCount: number;
  migratedAssets: number;
  skippedAssetsAlreadyDone: number;
  removedNotInEam: number;
  reliefCount: number;
  consumableCount: number;
  assetFailures: string[];
}): string {
  const lines = [
    `# IFRC catalogue audit — execution report`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| IFRC seed rows present in DB before (\`item_code\` in seed list) | ${p.beforeCount} |`,
    `| Remaining in \`inventory_catalogue\` (IFRC codes still present) | ${p.afterWmsCount} |`,
    `| Expected IFRC rows in catalogue after apply | 41 (48 seed codes − 7 asset migrations) |`,
    `| Asset migrations performed this run | ${p.migratedAssets} |`,
    `| Asset rows skipped (already migrated / duplicate assetTag) | ${p.skippedAssetsAlreadyDone} |`,
    `| Removed (NOT_IN_EAM) — IFRC seed | ${p.removedNotInEam} |`,
    `| Among remaining — RELIEF_ITEM | ${p.reliefCount} |`,
    `| Among remaining — CONSUMABLE | ${p.consumableCount} |`,
    `| Hard failures | ${p.assetFailures.length} |`,
    ``,
  ];
  if (p.assetFailures.length) {
    lines.push(`## Failures`, ``);
    for (const f of p.assetFailures) lines.push(`- ${f}`);
    lines.push(``);
  }
  lines.push(`Run \`pnpm db:audit:catalogue-wms\` after this script.`);
  lines.push(``);
  lines.push(`**Gate:** Phase 2 code should not start until product approves these counts.`);
  return lines.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
