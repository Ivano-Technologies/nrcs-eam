/**
 * Prints a Markdown audit of inventory_catalogue rows for WMS vs Assets scope.
 * Usage: pnpm db:audit:catalogue-wms
 */
import "dotenv/config";
import { asc } from "drizzle-orm";
import { inventoryCatalogue } from "../../drizzle/schema";
import { getDb, resetDbConnection } from "../../server/db";
import { IFRC_CATALOGUE_SEED } from "../../shared/inventoryCatalogueSeed";
import { IFRC_CATALOGUE_CLASSIFICATION, type WmsCatalogueClass } from "../../shared/ifrcCatalogueWmsClassification";

const IFRC_CATEGORY = new Map(IFRC_CATALOGUE_SEED.map((x) => [x.itemCode, x.category] as const));

function classifyItemCode(itemCode: string, category: string, name: string): WmsCatalogueClass {
  const fromSeed = IFRC_CATALOGUE_CLASSIFICATION[itemCode];
  if (fromSeed) return fromSeed.wmsClass;

  const ifrcCat = IFRC_CATEGORY.get(itemCode);
  const cat = ifrcCat ?? category;
  if (cat === "PPE") return "CONSUMABLE";
  if (cat === "Emergency Response Equipment") return "RELIEF_ITEM";
  if (cat === "Food" || cat === "Shelter" || cat === "Kits") return "RELIEF_ITEM";
  if (cat === "WASH") return "RELIEF_ITEM";
  if (cat === "Health") return "RELIEF_ITEM";
  if (cat === "NFI") return "RELIEF_ITEM";

  const n = `${name} ${itemCode}`.toLowerCase();
  if (/\bgenerator\b|\b5kva\b|\bgps\b|\bvehicle\b|\bambulance\b|\blaptop\b|\bcomputer\b|\bphotocopier\b/.test(n)) {
    return "ASSET";
  }
  if (/\bsoap\b|\btablet\b|\bsachet\b|\bglove\b|\bmask\b|\bsanitiser\b|\bparacetamol\b|\bors\b/.test(n)) {
    return "CONSUMABLE";
  }
  return "RELIEF_ITEM";
}

function proposalFor(c: WmsCatalogueClass, itemCode: string): string {
  if (c === "ASSET") return "Remove from inventory_catalogue (test) or migrate to Asset Register — no CTN.";
  if (c === "CONSUMABLE") return "Keep in WMS when stocked as humanitarian consignment.";
  return "Keep in WMS.";
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database unavailable (DATABASE_URL).");
    process.exit(1);
  }

  const rows = await db
    .select({
      itemCode: inventoryCatalogue.itemCode,
      name: inventoryCatalogue.name,
      category: inventoryCatalogue.category,
      itemCategory: inventoryCatalogue.itemCategory,
    })
    .from(inventoryCatalogue)
    .orderBy(asc(inventoryCatalogue.itemCode));

  const ambiguous: string[] = [];

  console.log("# Live DB — inventory_catalogue WMS audit\n");
  console.log("| item_code | name | category | item_category | class | proposal |");
  console.log("|-----------|------|----------|----------------|-------|----------|");

  for (const r of rows) {
    const cls = classifyItemCode(r.itemCode, r.category, r.name);
    const prop = proposalFor(cls, r.itemCode);
    const safeName = r.name.replace(/\|/g, "\\|");
    console.log(
      `| ${r.itemCode} | ${safeName} | ${r.category} | ${r.itemCategory} | ${cls} | ${prop} |`
    );

    if (!IFRC_CATALOGUE_CLASSIFICATION[r.itemCode]) {
      const n = `${r.name} ${r.itemCode} ${r.category}`.toLowerCase();
      if (
        /\b(paper|toner|ink|flipchart|pen|pencil|stapler|folder)\b/.test(n) &&
        !/\b(grn|waybill|distribution|beneficiary|thermal|label|registration|humanitarian|field)\b/.test(n)
      ) {
        ambiguous.push(
          `- **${r.itemCode}** — possible office supply vs operational consumable; apply pattern guide or flag for review.`
        );
      }
    }
  }

  if (ambiguous.length) {
    console.log("\n## Flag for manual review (non-seed / ambiguous office vs ops)\n");
    for (const line of ambiguous) console.log(line);
  }

  await resetDbConnection();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
