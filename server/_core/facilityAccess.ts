import { TRPCError } from "@trpc/server";

// The shape of the user object available in tRPC context
interface ScopedUser {
  role: string;
  siteId: number | null;
}

const STAFF_ROLES = ["staff", "field"] as const;
const ELEVATED_ROLES = ["manager", "admin"] as const;

function isStaffOrField(role: string): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

function isManagerOrAdmin(role: string): boolean {
  return (ELEVATED_ROLES as readonly string[]).includes(role);
}

/**
 * assertFacilityAccess
 *
 * Use on mutations and getById calls where a specific siteId is
 * provided by the client.
 *
 * - Manager/admin: always allowed (pass-through)
 * - Staff/field with matching siteId: allowed
 * - Staff/field with non-matching siteId: throws FORBIDDEN
 * - Staff/field with no assigned siteId: throws FORBIDDEN
 */
export function assertFacilityAccess(
  user: ScopedUser,
  requestedSiteId: number
): void {
  if (isManagerOrAdmin(user.role)) return;
  if (isStaffOrField(user.role)) {
    if (user.siteId == null) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your account is not assigned to a facility.",
      });
    }
    if (user.siteId !== requestedSiteId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this facility.",
      });
    }
    return;
  }
  // Any other role (e.g. "user"): deny by default
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Insufficient permissions.",
  });
}

/**
 * enforceFacilityScope
 *
 * Use on list queries where siteId is an optional filter.
 *
 * - Manager/admin: returns the client-provided siteId as-is
 *   (undefined means all facilities, which is correct for managers)
 * - Staff/field: always returns ctx.user.siteId regardless of what
 *   the client sent (prevents cross-facility enumeration)
 * - Staff/field with no assigned siteId: returns -1 so the query
 *   returns zero rows rather than all rows
 *
 * Usage:
 *   const siteId = enforceFacilityScope(ctx.user, input.siteId);
 *   const results = await db.getAssets({ siteId });
 */
export function enforceFacilityScope(
  user: ScopedUser,
  clientSiteId?: number
): number | undefined {
  if (isManagerOrAdmin(user.role)) {
    return clientSiteId; // trust the client filter
  }
  if (isStaffOrField(user.role)) {
    if (user.siteId == null) {
      return -1; // no facility assigned — return nothing
    }
    return user.siteId; // always use their own facility
  }
  return -1; // unknown role — return nothing
}

/**
 * assertRecordFacilityAccess
 *
 * Use after loading a record by ID to verify the record belongs
 * to a facility the user can access.
 *
 * - Manager/admin: always allowed
 * - Staff/field: recordSiteId must match ctx.user.siteId
 */
export function assertRecordFacilityAccess(
  user: ScopedUser,
  recordSiteId: number | null | undefined
): void {
  if (isManagerOrAdmin(user.role)) return;
  if (recordSiteId == null) return; // record not facility-scoped
  if (isStaffOrField(user.role)) {
    if (user.siteId == null || user.siteId !== recordSiteId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this record.",
      });
    }
    return;
  }
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Insufficient permissions to access this record.",
  });
}
