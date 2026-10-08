type TechnicalFields = {
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  location?: string | null;
};

const filled = (v: string | null | undefined) => typeof v === "string" && v.trim() !== "";

/** The asset detail "Technical details" card only renders when at least one of its fields has a value. */
export function hasTechnicalDetails(asset: TechnicalFields | null | undefined): boolean {
  if (!asset) return false;
  return filled(asset.manufacturer) || filled(asset.model) || filled(asset.serialNumber) || filled(asset.location);
}
