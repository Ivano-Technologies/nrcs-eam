/** Seed rows for `donors` — IFRC / humanitarian partners (WMS Phase 1) + system donors (Decision 4). */
export const WMS_DONOR_SEED: Array<{
  name: string;
  code: string;
  type:
    | "national_society"
    | "multilateral"
    | "corporate"
    | "government"
    | "individual"
    | "synthetic";
  country: string | null;
  notes: string | null;
}> = [
  { name: "Finnish Red Cross", code: "FRC", type: "national_society", country: "Finland", notes: null },
  { name: "Japanese Red Cross Society", code: "JRCS", type: "national_society", country: "Japan", notes: null },
  { name: "Norwegian Red Cross", code: "NORC", type: "national_society", country: "Norway", notes: null },
  { name: "Swedish Red Cross", code: "SRC", type: "national_society", country: "Sweden", notes: null },
  {
    name: "International Committee of the Red Cross",
    code: "ICRC",
    type: "multilateral",
    country: null,
    notes: null,
  },
  {
    name: "International Federation of Red Cross and Red Crescent Societies",
    code: "IFRC",
    type: "multilateral",
    country: null,
    notes: null,
  },
  {
    name: "United States Agency for International Development",
    code: "USAID",
    type: "government",
    country: "United States",
    notes: null,
  },
  {
    name: "EU Civil Protection and Humanitarian Aid (ECHO)",
    code: "ECHO",
    type: "multilateral",
    country: "European Union",
    notes: null,
  },
  {
    name: "Custom / other donor",
    code: "CUSTOM",
    type: "individual",
    country: null,
    notes: "Use for ad-hoc or unspecified donors",
  },
  {
    name: "Blended Contributors",
    code: "BLENDED",
    type: "multilateral",
    country: null,
    notes:
      "System-generated donor for kits assembled from multiple contributor CTNs. Contributing donors tracked per kit CTN.",
  },
  {
    name: "Legacy Stock (pre-WMS)",
    code: "LEGACY",
    type: "synthetic",
    country: null,
    notes: "System-generated donor for stock introduced before WMS adoption at a facility.",
  },
];
