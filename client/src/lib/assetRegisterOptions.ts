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
  "Air Conditioner", "Audio Device", "Borehole/Submersible Pump", "Cabinet", "Cabinet For Switch/Patch Panel",
  "Camera", "Cell Phone - Smartphone", "Chair - Office", "Chair - Revolving", "Chair - Round Meeting Table",
  "Chair - Visitors - Fixed Leg", "Combined Amplifier/Speaker", "Cooker", "CPU", "CPU - Desktop", "Cupboard",
  "Deskphone", "Digger", "Fan - Ceiling", "Fan - Stand", "Fan - Wall Bracket", "File Cabinet", "Forklift",
  "Freezer", "Generator", "GPS - Handheld", "Hard Drive - External", "Hard Drive - Internal",
  "Internet Dish + Accessories", "Inverter", "IT Equipment", "Laptop", "LED - Monitor for Desktop", "LED / TV",
  "LED / TV Stand Table", "Mechanical Medical Equipment", "Motorbike", "Office Building", "Photocopier",
  "Power Source", "Power Stabilizer", "Powered Medical Equipment", "Printer", "Printer & Scanner", "Projector",
  "Radio - Base Station", "Radio - HF", "Radio - VHF", "Radio - VHF Charger", "Receiver (Decoder)",
  "Refrigerator", "Safe - (Office Safe for cash)", "Satellite Dish", "Satellite Phone", "Scanner",
  "Security Camera", "Software", "Solar System Setup", "Surge Protector", "Table", "Table - Office",
  "Table - Round Meeting", "Tablet - IT", "Vehicle", "Video Camera", "Washing Machine", "Water Dispenser", "Other",
] as const;

export const YEAR_ACQUIRED_OPTIONS = Array.from({ length: 2027 - 1990 + 1 }, (_, i) => String(1990 + i));
