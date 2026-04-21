import "dotenv/config";
import { eq } from "drizzle-orm";
import { inventoryCatalogue, inventoryKits } from "../../drizzle/schema";
import { getDb } from "../../server/db";

type KitSeed = {
  kitCode: string;
  name: string;
  kitType: string;
  components: Array<{ itemCode: string; name: string; quantity: number; unit?: string }>;
};

const KITS: KitSeed[] = [
  {
    kitCode: "HYGKIT01",
    name: "Family Hygiene Kit",
    kitType: "hygiene",
    components: [
      { itemCode: "SOAPWASH03", name: "Soap bars", quantity: 5 },
      { itemCode: "TOOTHBRUSH01", name: "Toothbrush", quantity: 5 },
      { itemCode: "TOOTHPASTE01", name: "Toothpaste", quantity: 2 },
      { itemCode: "SANPAD01", name: "Sanitary pads pack", quantity: 10 },
      { itemCode: "WASHCLOTH01", name: "Washcloth", quantity: 2 },
      { itemCode: "LAUNDRYSOAP01", name: "Laundry soap", quantity: 1 },
      { itemCode: "COMB01", name: "Comb", quantity: 1 },
    ],
  },
  {
    kitCode: "SHLTKIT02",
    name: "Emergency Shelter Kit",
    kitType: "shelter",
    components: [
      { itemCode: "TARPSHEL01", name: "Tarpaulin", quantity: 1 },
      { itemCode: "ROPSHEL06", name: "Rope", quantity: 1 },
      { itemCode: "PEGSHEL07", name: "Tent pegs", quantity: 10 },
      { itemCode: "HAMMER01", name: "Hammer", quantity: 1 },
      { itemCode: "NAILS01", name: "Nails assortment", quantity: 1 },
    ],
  },
  {
    kitCode: "FAKIT03",
    name: "Family First Aid Kit",
    kitType: "first_aid",
    components: [
      { itemCode: "BANDAGE01", name: "Bandages", quantity: 5 },
      { itemCode: "ANTISEPTIC01", name: "Antiseptic", quantity: 2 },
      { itemCode: "PLASTER01", name: "Plasters pack", quantity: 1 },
      { itemCode: "PAINRELIEF01", name: "Pain relief tablets", quantity: 1 },
      { itemCode: "THERMO01", name: "Thermometer", quantity: 1 },
      { itemCode: "SCISSORS01", name: "Scissors", quantity: 1 },
    ],
  },
  {
    kitCode: "KITCHEN01",
    name: "Kitchen Set",
    kitType: "kitchen",
    components: [
      { itemCode: "COOKPOT01", name: "Cooking pot", quantity: 2 },
      { itemCode: "FRYPAN01", name: "Frying pan", quantity: 1 },
      { itemCode: "PLATES01", name: "Plates", quantity: 5 },
      { itemCode: "CUPS01", name: "Cups", quantity: 5 },
      { itemCode: "CUTLERY01", name: "Cutlery sets", quantity: 5 },
      { itemCode: "KNIFE01", name: "Cooking knife", quantity: 1 },
      { itemCode: "WATERCONT01", name: "Water container", quantity: 1 },
    ],
  },
  {
    kitCode: "SCHKIT01",
    name: "School Kit",
    kitType: "school",
    components: [
      { itemCode: "EXBOOK01", name: "Exercise books", quantity: 10 },
      { itemCode: "PENS01", name: "Pens", quantity: 5 },
      { itemCode: "PENCILS01", name: "Pencils", quantity: 5 },
      { itemCode: "ERASER01", name: "Eraser", quantity: 2 },
      { itemCode: "RULER01", name: "Ruler", quantity: 1 },
      { itemCode: "BACKPACK01", name: "Backpack", quantity: 1 },
    ],
  },
];

async function ensureCatalogueItem(itemCode: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [existing] = await db.select().from(inventoryCatalogue).where(eq(inventoryCatalogue.itemCode, itemCode)).limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(inventoryCatalogue)
    .values({
      itemCode,
      name,
      category: "relief_item",
      unitOfMeasure: "unit",
      vedClassification: "essential",
      standardSuppliers: [],
      isActive: true,
    })
    .returning();
  return created.id;
}

async function run() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  for (const kit of KITS) {
    const componentRows = [];
    for (const comp of kit.components) {
      const catalogueId = await ensureCatalogueItem(comp.itemCode, comp.name);
      componentRows.push({ catalogueId, quantity: comp.quantity, unit: comp.unit ?? "unit", isOptional: false });
    }
    const kitCatalogueId = await ensureCatalogueItem(kit.kitCode, kit.name);
    await db
      .insert(inventoryKits)
      .values({
        kitCode: kit.kitCode,
        name: kit.name,
        kitType: kit.kitType,
        catalogueId: kitCatalogueId,
        components: componentRows,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: inventoryKits.kitCode,
        set: {
          name: kit.name,
          kitType: kit.kitType,
          catalogueId: kitCatalogueId,
          components: componentRows,
          updatedAt: new Date(),
        },
      });
  }

  console.log(`Seeded ${KITS.length} kit definitions.`);
}

run().catch((error) => {
  console.error("Failed to seed kits", error);
  process.exit(1);
});
