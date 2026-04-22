import type { ItemCategory } from "./itemCategory";

/** High-level WMS / Finance / Assets scope for audit and seed apply. */
export type EamScope = "wms" | "assets" | "not_in_eam";

export type WmsCatalogueClass = "RELIEF_ITEM" | "CONSUMABLE" | "ASSET";

export type IfrcCatalogueRowMeta = {
  wmsClass: WmsCatalogueClass;
  eamScope: EamScope;
  /** Persisted on `inventory_catalogue.item_category` for WMS rows. */
  itemCategory: ItemCategory;
  /** When `eamScope === "assets"`, seed `assetCategories.name` to resolve `categoryId`. */
  assetCategoryName?: string;
  /** Audit / operator notes (borderline resolutions, policy). */
  notes: string;
};

/**
 * Authoritative IFRC seed classification after borderline sign-off.
 * `inventory_catalogue` has no separate "WMS class" column — use `item_category` + EAM actions.
 */
export const IFRC_CATALOGUE_CLASSIFICATION: Record<string, IfrcCatalogueRowMeta> = {
  HEBFOOD01: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "food_nutrition",
    notes: "Relief food.",
  },
  RICFOOD02: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "food_nutrition",
    notes: "Relief food.",
  },
  OILFOOD03: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "food_nutrition",
    notes: "Relief food.",
  },
  SUGFOOD04: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "food_nutrition",
    notes: "Relief food.",
  },
  SALFOOD05: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "food_nutrition",
    notes: "Relief food.",
  },
  MILFOOD06: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "food_nutrition",
    notes: "Relief food.",
  },
  TARPSHEL01: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "shelter_nfi",
    notes: "Shelter response.",
  },
  TENTSHEL02: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "shelter_nfi",
    notes: "Shelter response.",
  },
  BLKTSHEL03: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "shelter_nfi",
    notes: "Shelter response.",
  },
  MATTSHEL04: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "shelter_nfi",
    notes: "Shelter response.",
  },
  PLASSHEL05: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "shelter_nfi",
    notes: "Shelter response.",
  },
  ROPSHEL06: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "shelter_nfi",
    notes: "Shelter response.",
  },
  PEGSHEL07: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "shelter_nfi",
    notes: "Shelter response.",
  },
  JERWASH01: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "wash",
    notes: "WASH response.",
  },
  BUCKWASH02: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "wash",
    notes: "WASH response.",
  },
  SOAPWASH03: {
    wmsClass: "CONSUMABLE",
    eamScope: "wms",
    itemCategory: "wash",
    notes: "Hygiene consumable.",
  },
  WATERWASH04: {
    wmsClass: "CONSUMABLE",
    eamScope: "wms",
    itemCategory: "wash",
    notes: "WASH consumable.",
  },
  FILTEWASH05: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "wash",
    notes: "Durable WASH relief item.",
  },
  TOILETWASH06: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "wash",
    notes: "WASH response.",
  },
  FAIDHLTH01: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "emergency_kits",
    notes: "Kit CTN flow (Phase 3).",
  },
  FAIDHLTH02: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "emergency_kits",
    notes: "Kit CTN flow (Phase 3).",
  },
  ORSHLTH03: {
    wmsClass: "CONSUMABLE",
    eamScope: "wms",
    itemCategory: "medical_supplies",
    notes: "Medical consumable.",
  },
  MALHLTH04: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "medical_supplies",
    notes: "Health response.",
  },
  PRCTHLTH05: {
    wmsClass: "CONSUMABLE",
    eamScope: "wms",
    itemCategory: "medical_supplies",
    notes: "Medical consumable.",
  },
  BPRESURE06: {
    wmsClass: "ASSET",
    eamScope: "assets",
    itemCategory: "other",
    assetCategoryName: "Medical Equipment",
    notes: "Final: Asset Register — clinical device; not WMS CTN stock.",
  },
  STRHLTH07: {
    wmsClass: "ASSET",
    eamScope: "assets",
    itemCategory: "other",
    assetCategoryName: "Medical Equipment",
    notes: "Final: Asset Register — stretcher equipment.",
  },
  KCOKNFI01: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "shelter_nfi",
    notes: "NFI response.",
  },
  LANTNFI02: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "shelter_nfi",
    notes:
      "Final: WMS RELIEF_ITEM — solar lantern treated as relief NFI (not capital asset register).",
  },
  RADIONFI03: {
    wmsClass: "ASSET",
    eamScope: "assets",
    itemCategory: "other",
    assetCategoryName: "Communication Equipment",
    notes:
      "Final: Asset Register — solar/wind-up radio classified with comms capital policy (signed off).",
  },
  TORCHNFI04: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "shelter_nfi",
    notes: "NFI response.",
  },
  CLOTHNFI05: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "shelter_nfi",
    notes: "NFI response.",
  },
  CLOTHNFI06: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "shelter_nfi",
    notes: "NFI response.",
  },
  GLOVPPE01: {
    wmsClass: "CONSUMABLE",
    eamScope: "wms",
    itemCategory: "medical_supplies",
    notes: "PPE consumable.",
  },
  MASKPPE02: {
    wmsClass: "CONSUMABLE",
    eamScope: "wms",
    itemCategory: "medical_supplies",
    notes: "PPE consumable.",
  },
  N95PPE03: {
    wmsClass: "CONSUMABLE",
    eamScope: "wms",
    itemCategory: "medical_supplies",
    notes: "PPE consumable.",
  },
  GOGPPE04: {
    wmsClass: "CONSUMABLE",
    eamScope: "wms",
    itemCategory: "medical_supplies",
    notes: "PPE consumable.",
  },
  APRPPE05: {
    wmsClass: "CONSUMABLE",
    eamScope: "wms",
    itemCategory: "medical_supplies",
    notes: "PPE consumable.",
  },
  HANDPPE06: {
    wmsClass: "CONSUMABLE",
    eamScope: "wms",
    itemCategory: "medical_supplies",
    notes: "PPE consumable.",
  },
  GENEQP01: {
    wmsClass: "ASSET",
    eamScope: "assets",
    itemCategory: "other",
    assetCategoryName: "Machinery",
    notes: "Final: Asset Register — generator.",
  },
  FLDLGHTEQP02: {
    wmsClass: "CONSUMABLE",
    eamScope: "wms",
    itemCategory: "equipment_tools",
    notes:
      "Final: WMS CONSUMABLE — rechargeable field flood lighting consumed in humanitarian operations (not Asset Register).",
  },
  MEGPHEQP03: {
    wmsClass: "ASSET",
    eamScope: "assets",
    itemCategory: "other",
    assetCategoryName: "Communication Equipment",
    notes: "Final: Asset Register — megaphone (field CEA / comms equipment policy).",
  },
  COMRADEQP04: {
    wmsClass: "ASSET",
    eamScope: "assets",
    itemCategory: "other",
    assetCategoryName: "Communication Equipment",
    notes: "Final: Asset Register — VHF handheld radio.",
  },
  GPSEQP05: {
    wmsClass: "ASSET",
    eamScope: "assets",
    itemCategory: "other",
    assetCategoryName: "IT Equipment",
    notes: "Final: Asset Register — handheld GPS.",
  },
  HYGKIT01: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "emergency_kits",
    notes: "Kit CTN flow.",
  },
  SHLTKIT02: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "emergency_kits",
    notes: "Kit CTN flow.",
  },
  FAKIT03: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "emergency_kits",
    notes: "Kit CTN flow.",
  },
  KITCHEN01: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "emergency_kits",
    notes: "Kit CTN flow.",
  },
  SCHKIT01: {
    wmsClass: "RELIEF_ITEM",
    eamScope: "wms",
    itemCategory: "emergency_kits",
    notes: "Education-in-emergency kit; not admin stationery.",
  },
};

const IFRC_CODES = Object.keys(IFRC_CATALOGUE_CLASSIFICATION);

export function getAllIfrcItemCodes(): string[] {
  return IFRC_CODES.slice();
}

export function assertFullIfrcCoverage(seedItemCodes: string[]): void {
  const missing = seedItemCodes.filter((c) => !IFRC_CATALOGUE_CLASSIFICATION[c]);
  const extra = IFRC_CODES.filter((c) => !seedItemCodes.includes(c));
  if (missing.length || extra.length) {
    throw new Error(
      `IFRC_CATALOGUE_CLASSIFICATION out of sync with seed: missing=${missing.join(",")} extra=${extra.join(",")}`
    );
  }
}
