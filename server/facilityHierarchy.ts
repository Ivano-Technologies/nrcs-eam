import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { sites } from "../drizzle/schema";
import type { FacilityType } from "../shared/facilities";
import * as db from "./db";

const PARENT_RULES: Record<FacilityType, FacilityType[]> = {
  national_headquarters: [],
  branch: ["national_headquarters"],
  division: ["branch"],
  warehouse: ["branch"],
  clinic: ["branch"],
};

export function validateHierarchyRule(
  facilityType: FacilityType,
  parentType: FacilityType | null
): string | null {
  const allowedParents = PARENT_RULES[facilityType];
  if (allowedParents.length === 0) {
    return parentType === null ? null : "National headquarters cannot have a parent facility";
  }
  if (parentType === null) {
    return `${facilityType} requires a parent facility`;
  }
  if (!allowedParents.includes(parentType)) {
    return `${facilityType} parent must be ${allowedParents.join(" or ")}, got ${parentType}`;
  }
  return null;
}

async function getFacilityDepthFromRoot(
  facilityId: number
): Promise<number> {
  const database = await db.getDb();
  if (!database) return 0;

  let depth = 0;
  let currentId: number | null = facilityId;
  const visited = new Set<number>();
  while (currentId != null) {
    if (visited.has(currentId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Circular parent chain detected",
      });
    }
    visited.add(currentId);
    const row: Array<{ parentFacilityId: number | null }> = await database
      .select({ parentFacilityId: sites.parentFacilityId })
      .from(sites)
      .where(eq(sites.id, currentId))
      .limit(1);
    const parentId: number | null = row[0]?.parentFacilityId ?? null;
    if (parentId == null) break;
    depth += 1;
    currentId = parentId;
  }
  return depth;
}

export async function validateFacilityHierarchy(
  facilityType: FacilityType,
  parentFacilityId: number | null | undefined,
  selfId?: number,
  options?: {
    getParentFacility?: (
      id: number
    ) => Promise<{ id: number; facilityType: FacilityType; parentFacilityId: number | null } | null>;
    wouldCreateCycle?: (siteId: number, parentId: number | null) => Promise<boolean>;
    getDepth?: (facilityId: number) => Promise<number>;
  }
): Promise<void> {
  const database = await db.getDb();
  if (!database) return;

  const normalizedParentId = parentFacilityId ?? null;
  if (selfId != null && normalizedParentId === selfId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A facility cannot be its own parent",
    });
  }

  if (normalizedParentId == null) {
    const ruleError = validateHierarchyRule(facilityType, null);
    if (ruleError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: ruleError });
    }
    return;
  }

  const parent = options?.getParentFacility
    ? await options.getParentFacility(normalizedParentId)
    : await database
        .select({
          id: sites.id,
          facilityType: sites.facilityType,
          parentFacilityId: sites.parentFacilityId,
        })
        .from(sites)
        .where(eq(sites.id, normalizedParentId))
        .limit(1)
        .then((rows) => rows[0] ?? null);
  if (!parent) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Parent facility ${normalizedParentId} does not exist`,
    });
  }

  const ruleError = validateHierarchyRule(facilityType, parent.facilityType);
  if (ruleError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: ruleError });
  }

  if (selfId != null) {
    const createsCycle = options?.wouldCreateCycle
      ? await options.wouldCreateCycle(selfId, normalizedParentId)
      : await db.wouldCreateFacilityParentCycle(selfId, normalizedParentId);
    if (createsCycle) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid parent: would create a circular hierarchy.",
      });
    }
  }

  const parentDepth = options?.getDepth ? await options.getDepth(parent.id) : await getFacilityDepthFromRoot(parent.id);
  const nextDepth = parentDepth + 1;
  if (nextDepth > 2) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Max hierarchy depth is 2 levels (NHQ → Branch → Child).",
    });
  }
}

