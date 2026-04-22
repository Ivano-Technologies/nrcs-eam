import "dotenv/config";
import { inArray, sql } from "drizzle-orm";
import { inventoryCatalogue } from "../../drizzle/schema";
import { getDb } from "../../server/db";
import { IFRC_CATALOGUE_SEED } from "../../shared/inventoryCatalogueSeed";
import { assertFullIfrcCoverage, IFRC_CATALOGUE_CLASSIFICATION } from "../../shared/ifrcCatalogueWmsClassification";

async function run() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database unavailable");
  }

  assertFullIfrcCoverage(IFRC_CATALOGUE_SEED.map((x) => x.itemCode));

  await db
    .insert(inventoryCatalogue)
    .values(
      IFRC_CATALOGUE_SEED.map((item) => ({
        itemCode: item.itemCode,
        name: item.name,
        description: item.description ?? null,
        category: item.category,
        itemCategory: IFRC_CATALOGUE_CLASSIFICATION[item.itemCode].itemCategory,
        unitOfMeasure: item.unitOfMeasure,
        vedClassification: item.vedClassification,
        hasExpiry: item.hasExpiry ?? false,
        coldChainRequired: item.coldChainRequired ?? false,
        unitWeightKg: null,
        standardSuppliers: [],
        ifrcItemCode: item.itemCode,
        isActive: true,
      }))
    )
    .onConflictDoUpdate({
      target: inventoryCatalogue.itemCode,
      set: {
        itemCategory: sql`excluded.item_category`,
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        category: sql`excluded.category`,
        unitOfMeasure: sql`excluded.unit_of_measure`,
        vedClassification: sql`excluded.ved_classification`,
        hasExpiry: sql`excluded.has_expiry`,
        coldChainRequired: sql`excluded.cold_chain_required`,
        ifrcItemCode: sql`excluded.ifrc_item_code`,
        isActive: sql`excluded.is_active`,
        updatedAt: new Date(),
      },
    });

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(inventoryCatalogue)
    .where(inArray(inventoryCatalogue.itemCode, IFRC_CATALOGUE_SEED.map((x) => x.itemCode)));

  console.log(`IFRC catalogue import complete. Seed items present: ${count ?? 0}`);
}

run().catch((err) => {
  console.error("Failed to import IFRC catalogue", err);
  process.exit(1);
});
