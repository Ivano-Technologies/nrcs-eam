/**
 * Official NRCS Asset Register — item category codes (`item_category` / `assetCategories.name`)
 * and register UI lists. Only these eight names participate in two-letter codes.
 */
export const ITEM_CATEGORY_CODE_MAP: Record<string, string> = {
  Computer: "CO",
  "Furniture & Fixtures": "FF",
  Generator: "GE",
  Land: "LA",
  "Land & Building": "LB",
  "Medical Equipment": "ME",
  "Office Equipment": "OE",
  Vehicle: "VE",
};

/** Item Category choices when register Item Type = Asset (template). */
export const REGISTER_ITEM_CATEGORY_OPTIONS_ASSET = [
  "Vehicle",
  "Communications Equipment",
  "Computer Equipment",
  "Office Equipment",
  "Other Equipment",
] as const;

/** Item Category choices when register Item Type = Inventory (template). */
export const REGISTER_ITEM_CATEGORY_OPTIONS_INVENTORY = [
  "Furniture",
  "First Aid Equipment / Mobility Equipment",
  "Visibility",
  "Other",
] as const;

const CANONICAL_CATEGORY_NAMES = new Set(Object.keys(ITEM_CATEGORY_CODE_MAP));

/** Map register template label → canonical `assetCategories.name` / `item_category` for codes & FK. */
export function canonicalItemCategoryForRegisterLabel(
  registerLabel: string,
  itemType: "asset" | "inventory"
): string | null {
  const t = registerLabel.trim();
  if (!t) return null;
  if (CANONICAL_CATEGORY_NAMES.has(t)) return t;

  if (itemType === "asset") {
    if (t === "Vehicle") return "Vehicle";
    if (t === "Office Equipment") return "Office Equipment";
    if (t === "Communications Equipment") return "Office Equipment";
    if (t === "Computer Equipment") return "Computer";
    if (t === "Other Equipment") return "Office Equipment";
    return null;
  }

  if (t === "Furniture") return "Furniture & Fixtures";
  if (t === "First Aid Equipment / Mobility Equipment") return "Medical Equipment";
  if (t === "Visibility") return "Office Equipment";
  if (t === "Other") return "Office Equipment";
  return null;
}

/** Best register template label for edit UI when only canonical name is known. */
export function registerLabelHintForCanonical(canonical: string, itemType: "asset" | "inventory"): string {
  if (itemType === "inventory") {
    const inv: Record<string, string> = {
      "Furniture & Fixtures": "Furniture",
      "Medical Equipment": "First Aid Equipment / Mobility Equipment",
      "Office Equipment": "Other",
      Vehicle: "Other",
      Computer: "Other",
      Generator: "Other",
      Land: "Other",
      "Land & Building": "Other",
    };
    return inv[canonical] ?? "Other";
  }
  const ass: Record<string, string> = {
    Vehicle: "Vehicle",
    Computer: "Computer Equipment",
    "Office Equipment": "Office Equipment",
    "Medical Equipment": "Other Equipment",
    "Furniture & Fixtures": "Other Equipment",
    Generator: "Other Equipment",
    Land: "Other Equipment",
    "Land & Building": "Other Equipment",
  };
  return ass[canonical] ?? "Other Equipment";
}

export function registerItemCategoryOptionsForItemType(itemType: "asset" | "inventory"): readonly string[] {
  return itemType === "inventory"
    ? REGISTER_ITEM_CATEGORY_OPTIONS_INVENTORY
    : REGISTER_ITEM_CATEGORY_OPTIONS_ASSET;
}

export const METHOD_OF_ACQUISITION_OPTIONS = [
  "Donated By ICRC",
  "Donated By IFRC",
  "Donated by Other Donor",
  "Purchase Through Project",
  "Purchase Through Internal Funding",
  "Other",
] as const;

export const CURRENT_STATUS_OPTIONS = [
  "In Use",
  "In Store",
  "Under Maintenance",
  "Disposed",
  "To be Disposed",
] as const;

export const CONDITION_OPTIONS = [
  "Good",
  "Fair",
  "Damaged",
  "Beyond Repair (For Disposal)",
  "Out of Order (To be repaired)",
] as const;

export const SUB_ITEM_CATEGORIES = [
  "Air Conditioner",
  "Audio Device",
  "Borehole/Submersible Pump",
  "Cabinet",
  "Cabinet For Switch/Patch Panel",
  "Camera",
  "Cell Phone - Smartphone",
  "Chair - Office",
  "Chair - Revolving",
  "Chair - Round Meeting Table",
  "Chair - Visitors - Fixed Leg",
  "Combined Amplifier/Speaker",
  "Cooker",
  "CPU",
  "CPU - Desktop",
  "Cupboard",
  "Deskphone",
  "Digger",
  "Fan - Ceiling",
  "Fan - Stand",
  "Fan - Wall Bracket",
  "File Cabinet",
  "Forklift",
  "Freezer",
  "Generator",
  "GPS - Handheld",
  "Hard Drive - External",
  "Hard Drive - Internal",
  "Internet Dish + Accessories",
  "Inverter",
  "IT Equipment",
  "Laptop",
  "LED - Monitor for Desktop",
  "LED / TV",
  "LED / TV Stand Table",
  "Mechanical Medical Equipment",
  "Motorbike",
  "Office Building",
  "Photocopier",
  "Power Source",
  "Power Stabilizer",
  "Powered Medical Equipment",
  "Printer",
  "Printer & Scanner",
  "Projector",
  "Radio - Base Station",
  "Radio - HF",
  "Radio - VHF",
  "Radio - VHF Charger",
  "Receiver (Decoder)",
  "Refrigerator",
  "Safe - (Office Safe for cash)",
  "Satellite Dish",
  "Satellite Phone",
  "Scanner",
  "Security Camera",
  "Software",
  "Solar System Setup",
  "Surge Protector",
  "Table",
  "Table - Office",
  "Table - Round Meeting",
  "Tablet - IT",
  "Vehicle",
  "Video Camera",
  "Washing Machine",
  "Water Dispenser",
  "Other",
] as const;

export const YEAR_ACQUIRED_OPTIONS = Array.from({ length: 2027 - 1990 + 1 }, (_, i) => String(1990 + i));
