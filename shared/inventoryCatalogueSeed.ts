export type VedClassification = "vital" | "essential" | "desirable";

export type InventoryCatalogueSeedItem = {
  itemCode: string;
  name: string;
  description?: string;
  unitOfMeasure: string;
  category:
    | "Food"
    | "Shelter"
    | "WASH"
    | "Health"
    | "NFI"
    | "PPE"
    | "Emergency Response Equipment"
    | "Kits";
  vedClassification: VedClassification;
  hasExpiry?: boolean;
  coldChainRequired?: boolean;
};

export const INVENTORY_CATEGORIES = [
  "Food",
  "Shelter",
  "WASH",
  "Health",
  "NFI",
  "PPE",
  "Emergency Response Equipment",
  "Kits",
] as const;

export const INVENTORY_VED_VALUES = ["vital", "essential", "desirable"] as const;

export const IFRC_CATALOGUE_SEED: InventoryCatalogueSeedItem[] = [
  { itemCode: "HEBFOOD01", name: "High Energy Biscuits (HEB), 100g packet", unitOfMeasure: "packets", category: "Food", vedClassification: "vital", hasExpiry: true },
  { itemCode: "RICFOOD02", name: "Rice, white, 50kg bag", unitOfMeasure: "bags", category: "Food", vedClassification: "essential", hasExpiry: true },
  { itemCode: "OILFOOD03", name: "Vegetable Oil, 1L bottle", unitOfMeasure: "bottles", category: "Food", vedClassification: "essential", hasExpiry: true },
  { itemCode: "SUGFOOD04", name: "Sugar, white, 1kg bag", unitOfMeasure: "bags", category: "Food", vedClassification: "desirable", hasExpiry: true },
  { itemCode: "SALFOOD05", name: "Iodised Salt, 1kg bag", unitOfMeasure: "bags", category: "Food", vedClassification: "essential", hasExpiry: false },
  { itemCode: "MILFOOD06", name: "Powdered Milk, 500g tin", unitOfMeasure: "tins", category: "Food", vedClassification: "essential", hasExpiry: true },
  { itemCode: "TARPSHEL01", name: "Tarpaulin, 4m x 6m, white reinforced", unitOfMeasure: "pieces", category: "Shelter", vedClassification: "vital" },
  { itemCode: "TENTSHEL02", name: "Family Tent, 16 sqm", unitOfMeasure: "pieces", category: "Shelter", vedClassification: "vital" },
  { itemCode: "BLKTSHEL03", name: "Blanket, synthetic, 1.5m x 2m", unitOfMeasure: "pieces", category: "Shelter", vedClassification: "essential" },
  { itemCode: "MATTSHEL04", name: "Sleeping Mat, straw, 1.8m x 0.8m", unitOfMeasure: "pieces", category: "Shelter", vedClassification: "essential" },
  { itemCode: "PLASSHEL05", name: "Plastic Sheeting, 4m x 50m roll", unitOfMeasure: "rolls", category: "Shelter", vedClassification: "vital" },
  { itemCode: "ROPSHEL06", name: "Rope, polyester, 10mm, 100m", unitOfMeasure: "rolls", category: "Shelter", vedClassification: "essential" },
  { itemCode: "PEGSHEL07", name: "Tent Peg, galvanised, 30cm", unitOfMeasure: "pieces", category: "Shelter", vedClassification: "essential" },
  { itemCode: "JERWASH01", name: "Jerry Can, 20L collapsible", unitOfMeasure: "pieces", category: "WASH", vedClassification: "vital" },
  { itemCode: "BUCKWASH02", name: "Bucket with lid, 14L", unitOfMeasure: "pieces", category: "WASH", vedClassification: "vital" },
  { itemCode: "SOAPWASH03", name: "Soap, bar, 100g", unitOfMeasure: "pieces", category: "WASH", vedClassification: "essential" },
  { itemCode: "WATERWASH04", name: "Water Purification Tablets (Aquatabs), 33mg, strip of 10", unitOfMeasure: "strips", category: "WASH", vedClassification: "vital", hasExpiry: true },
  { itemCode: "FILTEWASH05", name: "Household Water Filter, ceramic", unitOfMeasure: "pieces", category: "WASH", vedClassification: "essential" },
  { itemCode: "TOILETWASH06", name: "Emergency Toilet Kit", unitOfMeasure: "kits", category: "WASH", vedClassification: "essential" },
  { itemCode: "FAIDHLTH01", name: "First Aid Kit, family", unitOfMeasure: "kits", category: "Health", vedClassification: "vital", hasExpiry: true },
  { itemCode: "FAIDHLTH02", name: "First Aid Kit, community", unitOfMeasure: "kits", category: "Health", vedClassification: "vital", hasExpiry: true },
  { itemCode: "ORSHLTH03", name: "ORS Sachets (Oral Rehydration Salts), sachet", unitOfMeasure: "sachets", category: "Health", vedClassification: "vital", hasExpiry: true },
  { itemCode: "MALHLTH04", name: "Mosquito Net, long-lasting insecticidal (LLIN)", unitOfMeasure: "pieces", category: "Health", vedClassification: "vital" },
  { itemCode: "PRCTHLTH05", name: "Paracetamol tablets, 500mg, pack of 100", unitOfMeasure: "packs", category: "Health", vedClassification: "essential", hasExpiry: true },
  { itemCode: "BPRESURE06", name: "Blood Pressure Monitor, manual", unitOfMeasure: "pieces", category: "Health", vedClassification: "essential" },
  { itemCode: "STRHLTH07", name: "Stretcher, foldable", unitOfMeasure: "pieces", category: "Health", vedClassification: "essential" },
  { itemCode: "KCOKNFI01", name: "Kitchen Set (family, IFRC standard)", unitOfMeasure: "sets", category: "NFI", vedClassification: "essential" },
  { itemCode: "LANTNFI02", name: "Solar Lantern", unitOfMeasure: "pieces", category: "NFI", vedClassification: "essential" },
  { itemCode: "RADIONFI03", name: "Radio, solar/wind-up", unitOfMeasure: "pieces", category: "NFI", vedClassification: "desirable" },
  { itemCode: "TORCHNFI04", name: "Flashlight, LED, rechargeable", unitOfMeasure: "pieces", category: "NFI", vedClassification: "essential" },
  { itemCode: "CLOTHNFI05", name: "Clothing Kit, adult", unitOfMeasure: "kits", category: "NFI", vedClassification: "essential" },
  { itemCode: "CLOTHNFI06", name: "Clothing Kit, child", unitOfMeasure: "kits", category: "NFI", vedClassification: "essential" },
  { itemCode: "GLOVPPE01", name: "Examination Gloves, nitrile, box of 100", unitOfMeasure: "boxes", category: "PPE", vedClassification: "vital", hasExpiry: true },
  { itemCode: "MASKPPE02", name: "Surgical Face Mask, 3-ply, box of 50", unitOfMeasure: "boxes", category: "PPE", vedClassification: "vital" },
  { itemCode: "N95PPE03", name: "N95 Respirator Mask, box of 20", unitOfMeasure: "boxes", category: "PPE", vedClassification: "vital" },
  { itemCode: "GOGPPE04", name: "Safety Goggles", unitOfMeasure: "pieces", category: "PPE", vedClassification: "essential" },
  { itemCode: "APRPPE05", name: "Apron, plastic disposable, pack of 50", unitOfMeasure: "packs", category: "PPE", vedClassification: "essential" },
  { itemCode: "HANDPPE06", name: "Hand Sanitiser, 500ml bottle", unitOfMeasure: "bottles", category: "PPE", vedClassification: "vital", hasExpiry: true },
  { itemCode: "GENEQP01", name: "Portable Generator, 5kVA", unitOfMeasure: "pieces", category: "Emergency Response Equipment", vedClassification: "essential" },
  { itemCode: "FLDLGHTEQP02", name: "Flood Light, LED, rechargeable", unitOfMeasure: "pieces", category: "Emergency Response Equipment", vedClassification: "essential" },
  { itemCode: "MEGPHEQP03", name: "Megaphone", unitOfMeasure: "pieces", category: "Emergency Response Equipment", vedClassification: "essential" },
  { itemCode: "COMRADEQP04", name: "Communication Radio, VHF handheld", unitOfMeasure: "pieces", category: "Emergency Response Equipment", vedClassification: "essential" },
  { itemCode: "GPSEQP05", name: "GPS Device, handheld", unitOfMeasure: "pieces", category: "Emergency Response Equipment", vedClassification: "desirable" },
  {
    itemCode: "HYGKIT01",
    name: "Family Hygiene Kit (IFRC standard)",
    description: "Contains soap bars x5, toothbrush x5, toothpaste x2, sanitary pads x10, washcloth x2, laundry soap, comb, razor",
    unitOfMeasure: "kits",
    category: "Kits",
    vedClassification: "vital",
  },
  {
    itemCode: "SHLTKIT02",
    name: "Emergency Shelter Kit",
    description: "Contains 1x tarpaulin, 1x rope, 10x pegs, 1x hammer, 1x nails assortment",
    unitOfMeasure: "kits",
    category: "Kits",
    vedClassification: "vital",
  },
  { itemCode: "FAKIT03", name: "Family First Aid Kit", unitOfMeasure: "kits", category: "Kits", vedClassification: "vital", hasExpiry: true },
  {
    itemCode: "KITCHEN01",
    name: "Kitchen Set (IFRC standard)",
    description: "Contains cooking pot x2, frying pan, plates x5, cups x5, cutlery sets x5, cooking knife, water container",
    unitOfMeasure: "sets",
    category: "Kits",
    vedClassification: "essential",
  },
  {
    itemCode: "SCHKIT01",
    name: "School Kit",
    description: "Contains exercise books, pens, pencils, eraser, ruler, backpack",
    unitOfMeasure: "kits",
    category: "Kits",
    vedClassification: "desirable",
  },
];
