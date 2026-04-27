/**
 * One-off helper: rebuild manual-catalogue.json (68 items) for Appendix B.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cataloguePath = path.join(__dirname, "manual-catalogue.json");
const src = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));
if (
  Array.isArray(src) &&
  src.length === 68 &&
  src.some((r) => r.itemCode === "TOOTHBRUSH01") &&
  !src.some((r) => r.itemCode === "BPRESURE06")
) {
  console.log("manual-catalogue.json already contains 68 live items — nothing to do.");
  process.exit(0);
}

const REMOVE = new Set([
  "BPRESURE06",
  "STRHLTH07",
  "RADIONFI03",
  "GENEQP01",
  "MEGPHEQP03",
  "COMRADEQP04",
  "GPSEQP05",
]);

const ADD = [
  { itemCode: "TOOTHBRUSH01", name: "Toothbrush", category: "Other" },
  { itemCode: "TOOTHPASTE01", name: "Toothpaste", category: "Other" },
  { itemCode: "SANPAD01", name: "Sanitary pads pack", category: "Other" },
  { itemCode: "WASHCLOTH01", name: "Washcloth", category: "Other" },
  { itemCode: "LAUNDRYSOAP01", name: "Laundry soap", category: "Other" },
  { itemCode: "COMB01", name: "Comb", category: "Other" },
  { itemCode: "HAMMER01", name: "Hammer", category: "Other" },
  { itemCode: "NAILS01", name: "Nails assortment", category: "Other" },
  { itemCode: "BANDAGE01", name: "Bandages", category: "Other" },
  { itemCode: "ANTISEPTIC01", name: "Antiseptic", category: "Other" },
  { itemCode: "PLASTER01", name: "Plasters pack", category: "Other" },
  { itemCode: "PAINRELIEF01", name: "Pain relief tablets", category: "Other" },
  { itemCode: "THERMO01", name: "Thermometer", category: "Other" },
  { itemCode: "SCISSORS01", name: "Scissors", category: "Other" },
  { itemCode: "COOKPOT01", name: "Cooking pot", category: "Other" },
  { itemCode: "FRYPAN01", name: "Frying pan", category: "Other" },
  { itemCode: "PLATES01", name: "Plates", category: "Other" },
  { itemCode: "CUPS01", name: "Cups", category: "Other" },
  { itemCode: "CUTLERY01", name: "Cutlery sets", category: "Other" },
  { itemCode: "KNIFE01", name: "Cooking knife", category: "Other" },
  { itemCode: "WATERCONT01", name: "Water container", category: "Other" },
  { itemCode: "EXBOOK01", name: "Exercise books", category: "Other" },
  { itemCode: "PENS01", name: "Pens", category: "Other" },
  { itemCode: "PENCILS01", name: "Pencils", category: "Other" },
  { itemCode: "ERASER01", name: "Eraser", category: "Other" },
  { itemCode: "RULER01", name: "Ruler", category: "Other" },
  { itemCode: "BACKPACK01", name: "Backpack", category: "Other" },
];

const kept = src.filter((row) => !REMOVE.has(row.itemCode));
const merged = [...kept, ...ADD];

if (merged.length !== 68) {
  console.error(`Expected 68 items, got ${merged.length} (kept ${kept.length}, add ${ADD.length})`);
  process.exit(1);
}

fs.writeFileSync(cataloguePath, JSON.stringify(merged, null, 2));
console.log("Wrote manual-catalogue.json:", merged.length, "items");
