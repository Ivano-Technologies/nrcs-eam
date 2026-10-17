/**
 * IVA-181: facility delete guard. assets.branch_code references sites.code with ON DELETE SET NULL (0030),
 * and the asset_code trigger (0059) refuses any branch_code change, so deleting a facility that any asset
 * still points at (by siteId or by branch code) failed with a raw "asset_code is immutable" error. We check
 * first and return a clear message; a database refusal that slips past the check maps to the same message.
 */
import { eq, or } from "drizzle-orm";
import { assets, sites } from "../drizzle/schema";
import * as db from "./db";

import {
  FACILITY_DELETE_FAILED_MESSAGE,
  FACILITY_HAS_ASSETS_MESSAGE,
  FACILITY_HAS_CHILDREN_MESSAGE,
  FACILITY_NOT_FOUND_MESSAGE,
} from "../shared/facilityDelete";

export {
  FACILITY_DELETE_FAILED_MESSAGE,
  FACILITY_HAS_ASSETS_MESSAGE,
  FACILITY_HAS_CHILDREN_MESSAGE,
  FACILITY_NOT_FOUND_MESSAGE,
};

export type FacilityDeleteFailureReason = "has_assets" | "has_children" | "not_found" | "error";
export type FacilityDeleteFailure = { id: number; reason: FacilityDeleteFailureReason; message: string };

const MESSAGES: Record<FacilityDeleteFailureReason, string> = {
  has_assets: FACILITY_HAS_ASSETS_MESSAGE,
  has_children: FACILITY_HAS_CHILDREN_MESSAGE,
  not_found: FACILITY_NOT_FOUND_MESSAGE,
  error: FACILITY_DELETE_FAILED_MESSAGE,
};

export function facilityDeleteFailure(id: number, reason: FacilityDeleteFailureReason): FacilityDeleteFailure {
  return { id, reason, message: MESSAGES[reason] };
}

/** Why this facility can't be deleted, or null when it can. */
export async function getFacilityDeleteBlocker(
  site: { id: number; code: string | null }
): Promise<"has_assets" | "has_children" | null> {
  const handle = await db.getDb();
  if (!handle) return null;
  const linkedToSite = site.code
    ? or(eq(assets.siteId, site.id), eq(assets.branchCode, site.code))
    : eq(assets.siteId, site.id);
  const [linkedAsset] = await handle.select({ id: assets.id }).from(assets).where(linkedToSite).limit(1);
  if (linkedAsset) return "has_assets";
  const [child] = await handle.select({ id: sites.id }).from(sites).where(eq(sites.parentFacilityId, site.id)).limit(1);
  if (child) return "has_children";
  return null;
}

/** True when the database refused the delete because assets still reference the facility. */
export function isAssetReferenceError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let e: unknown = error;
  while (e && typeof e === "object" && !seen.has(e)) {
    seen.add(e);
    const msg = String((e as { message?: unknown }).message ?? "");
    if (/asset_code is immutable|assets_branch_code_sites_code_fk/i.test(msg)) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
