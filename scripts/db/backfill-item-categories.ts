/**
 * Bulk-assign `inventory_catalogue.item_category` from keyword rules on item name.
 * Review output before committing; run against the intended database only.
 *
 * Usage:
 *   pnpm exec tsx scripts/db/backfill-item-categories.ts
 *   pnpm exec tsx scripts/db/backfill-item-categories.ts --dry-run
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { inventoryCatalogue } from "../../drizzle/schema";
import { getDb, resetDbConnection } from "../../server/db";
import type { ItemCategory } from "../../shared/itemCategory";

function classifyItemCategory(name: string): ItemCategory {
  const n = name.toLowerCase();
  const rules: Array<{ value: ItemCategory; re: RegExp }> = [
    { value: "emergency_kits", re: /dignity kit|hygiene kit|family kit/i },
    { value: "medical_supplies", re: /first aid|bandage|gauze|medication|syringe/i },
    { value: "shelter_nfi", re: /blanket|tarpaulin|tent|mosquito net/i },
    { value: "wash", re: /water|jerry|jerrican|soap|bucket|hygiene/i },
    { value: "food_nutrition", re: /rice|beans|oil|flour|biscuit|food/i },
    { value: "equipment_tools", re: /generator|tool|ladder|rope/i },
  ];
  for (const { value, re } of rules) {
    if (re.test(n)) return value;
  }
  return "other";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({ id: inventoryCatalogue.id, name: inventoryCatalogue.name, itemCategory: inventoryCatalogue.itemCategory })
    .from(inventoryCatalogue);

  let changed = 0;
  for (const row of rows) {
    const next = classifyItemCategory(row.name);
    if (next === row.itemCategory) continue;
    changed++;
    console.log(`#${row.id} ${row.itemCategory} -> ${next} | ${row.name}`);
    if (!dryRun) {
      await db.update(inventoryCatalogue).set({ itemCategory: next }).where(eq(inventoryCatalogue.id, row.id));
    }
  }

  console.log(
    dryRun ? `Dry run: ${changed} row(s) would be updated (${rows.length} scanned).` : `Updated ${changed} row(s) (${rows.length} scanned).`
  );
  await resetDbConnection();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
