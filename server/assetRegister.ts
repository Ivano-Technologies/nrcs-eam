import type { InferSelectModel } from "drizzle-orm";
import { z } from "zod";
import type { assets } from "../drizzle/schema";

export type RegisterStatusKey =
  | "in_use"
  | "in_store"
  | "under_maintenance"
  | "disposed"
  | "to_be_disposed"
  | "out_of_order"
  | "beyond_repair";

export const REGISTER_STATUS_LABELS: Record<RegisterStatusKey, string> = {
  in_use: "In Use",
  in_store: "In Store",
  under_maintenance: "Under Maintenance",
  disposed: "Disposed",
  to_be_disposed: "To be Disposed",
  out_of_order: "Out of Order",
  beyond_repair: "Beyond Repair",
};

export const REGISTER_STATUS_OPTIONS = Object.entries(REGISTER_STATUS_LABELS).map(
  ([value, label]) => ({ value: value as RegisterStatusKey, label })
);

/** Legacy DB enum values */
export type LegacyAssetStatus =
  | "operational"
  | "maintenance"
  | "repair"
  | "retired"
  | "disposed";

export function registerStatusFromLegacy(status: LegacyAssetStatus): RegisterStatusKey {
  switch (status) {
    case "operational":
      return "in_use";
    case "maintenance":
      return "under_maintenance";
    case "repair":
      return "out_of_order";
    case "retired":
      return "to_be_disposed";
    case "disposed":
      return "disposed";
    default:
      return "in_use";
  }
}

export function legacyStatusFromRegister(rs: RegisterStatusKey): LegacyAssetStatus {
  switch (rs) {
    case "in_use":
    case "in_store":
      return "operational";
    case "under_maintenance":
      return "maintenance";
    case "out_of_order":
      return "repair";
    case "beyond_repair":
      return "repair";
    case "to_be_disposed":
      return "retired";
    case "disposed":
      return "disposed";
    default:
      return "operational";
  }
}

export function displayRegisterStatus(
  row: Pick<InferSelectModel<typeof assets>, "registerStatus" | "status">
): string {
  const key = row.registerStatus as RegisterStatusKey | null | undefined;
  if (key && REGISTER_STATUS_LABELS[key]) {
    return REGISTER_STATUS_LABELS[key];
  }
  const mapped = registerStatusFromLegacy(row.status as LegacyAssetStatus);
  return REGISTER_STATUS_LABELS[mapped];
}

export const ACQUISITION_METHODS = [
  "Purchased Through Project",
  "Purchased Through Internal Funding",
  "Donated by ICRC",
  "Donated by IFRC",
  "Donated by Other Donor",
  "By Local Organisation",
  "Other",
] as const;

export type AcquisitionMethod = (typeof ACQUISITION_METHODS)[number];

export const PHYSICAL_CONDITIONS = ["Good", "Fair", "Damaged", "Beyond Repair"] as const;

export const registerStatusZodEnum = z.enum([
  "in_use",
  "in_store",
  "under_maintenance",
  "disposed",
  "to_be_disposed",
  "out_of_order",
  "beyond_repair",
]);
