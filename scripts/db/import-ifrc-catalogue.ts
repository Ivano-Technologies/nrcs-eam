import "dotenv/config";
import { inArray, sql } from "drizzle-orm";
import { inventoryCatalogue } from "../../drizzle/schema";
import { getDb } from "../../server/db";
import { IFRC_CATALOGUE_SEED } from "../../shared/inventoryCatalogueSeed";

async function run() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database unavailable");
  }

  await db
    .insert(inventoryCatalogue)
    .values(
      IFRC_CATALOGUE_SEED.map((item) => ({
        itemCode: item.itemCode,
        name: item.name,
        description: item.description ?? null,
        category: item.category,
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
    .onConflictDoNothing({ target: inventoryCatalogue.itemCode });

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
