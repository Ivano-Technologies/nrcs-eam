export const FACILITY_TYPE_VALUES = ["branch", "division", "clinic", "warehouse", "national_headquarters"] as const;
export type FacilityType = (typeof FACILITY_TYPE_VALUES)[number];

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  branch: "Branch",
  division: "Division",
  clinic: "Clinic",
  warehouse: "Warehouse",
  national_headquarters: "National Headquarters",
};

export const FACILITY_TYPE_DESCRIPTIONS: Record<FacilityType, string> = {
  national_headquarters:
    "Oversight and management of NRCS National Headquarters facilities, assets, and administrative operations.",
  branch:
    "Monitor and manage branch office facilities, assets, and operational activities across states.",
  division:
    "Coordinate divisional assets, facility operations, and administrative resource management.",
  clinic:
    "Manage clinic facilities, medical assets, and healthcare operational infrastructure.",
  warehouse:
    "Oversee warehouse facilities, storage capacity, logistics operations, and stock handling activities.",
};

export const FACILITY_TYPE_EXAMPLES: Record<FacilityType, string> = {
  branch: "e.g. NRCS Abuja Branch",
  division: "e.g. Disaster Management Division",
  clinic: "e.g. NRCS First Aid Clinic, Lagos",
  warehouse: "e.g. NHQ Main Warehouse",
  national_headquarters: "e.g. NRCS National Headquarters",
};
