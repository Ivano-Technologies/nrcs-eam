export const FACILITY_TYPE_VALUES = ["branch", "division", "clinic", "warehouse", "national_headquarters"] as const;
export type FacilityType = (typeof FACILITY_TYPE_VALUES)[number];

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  branch: "Branch",
  division: "Division",
  clinic: "Clinic",
  warehouse: "Warehouse",
  national_headquarters: "National Headquarters",
};

export const FACILITY_TYPE_EXAMPLES: Record<FacilityType, string> = {
  branch: "e.g. NRCS Abuja Branch",
  division: "e.g. Disaster Management Division",
  clinic: "e.g. NRCS First Aid Clinic, Lagos",
  warehouse: "e.g. NHQ Main Warehouse",
  national_headquarters: "e.g. NRCS National Headquarters",
};
