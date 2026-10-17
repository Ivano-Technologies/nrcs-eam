import { and, asc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { fleetDrivers, sites, userPositions, users } from "../drizzle/schema";
import { isPerBranchPosition, type PositionDesignation } from "../shared/fleetPositions";
import * as db from "./db";

/**
 * Fleet Wave 0 (IVA-168): position designations and the driver flag. Tables come from migration 0061.
 * Until 0061 is applied the reads report `available: false` instead of failing the Users page.
 */

export type PositionAssignment = { position: PositionDesignation; siteId: number | null };
export type PositionRow = PositionAssignment & { userId: number; userName: string | null; siteName: string | null };
export type FleetDesignations = { available: boolean; driverUserIds: number[]; positions: PositionRow[] };

/**
 * Driver flag rule (Kezie, 17 Oct): any active user can be flagged, whatever their app role, because pool
 * drivers come from all over. Inactive or pending users can't.
 */
export function isDriverEligible(user: { status: string | null | undefined }): boolean {
  return (user.status ?? "active") === "active";
}

/** Postgres unique_violation, e.g. two admins assigning the same position at once. */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/** Postgres undefined_table, e.g. 0061 not applied yet. */
export function isMissingTableError(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "42P01" || e?.cause?.code === "42P01";
}

/**
 * Validate and normalise position assignments. Branch Secretary needs a facility; the organisation-wide
 * positions never carry one. Duplicates are dropped. Pure, for testing.
 */
export function normalisePositions(input: PositionAssignment[]): PositionAssignment[] {
  const seen = new Set<string>();
  const out: PositionAssignment[] = [];
  for (const p of input) {
    const perBranch = isPerBranchPosition(p.position);
    if (perBranch && p.siteId == null) throw new Error(`${p.position} needs a facility`);
    const siteId = perBranch ? p.siteId : null;
    const key = `${p.position}:${siteId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ position: p.position, siteId });
  }
  return out.sort((a, b) => a.position.localeCompare(b.position) || (a.siteId ?? 0) - (b.siteId ?? 0));
}

export async function listFleetDesignations(): Promise<FleetDesignations> {
  const database = await db.getDb();
  if (!database) return { available: false, driverUserIds: [], positions: [] };
  try {
    const [drivers, positions] = await Promise.all([
      database.select({ userId: fleetDrivers.userId }).from(fleetDrivers),
      database
        .select({
          userId: userPositions.userId,
          position: userPositions.position,
          siteId: userPositions.siteId,
          siteName: sites.name,
          userName: users.name,
        })
        .from(userPositions)
        .leftJoin(sites, eq(userPositions.siteId, sites.id))
        .leftJoin(users, eq(userPositions.userId, users.id))
        .orderBy(asc(userPositions.userId), asc(userPositions.position)),
    ]);
    return {
      available: true,
      driverUserIds: drivers.map((d) => d.userId),
      positions: positions.map((p) => ({ ...p, position: p.position as PositionDesignation })),
    };
  } catch (err) {
    if (isMissingTableError(err)) return { available: false, driverUserIds: [], positions: [] };
    throw err;
  }
}

export async function getUserDesignations(
  userId: number
): Promise<{ isDriver: boolean; positions: PositionAssignment[] }> {
  const database = await db.getDb();
  if (!database) throw new Error("Database not available");
  const [driver, positions] = await Promise.all([
    database.select({ userId: fleetDrivers.userId }).from(fleetDrivers).where(eq(fleetDrivers.userId, userId)),
    database
      .select({ position: userPositions.position, siteId: userPositions.siteId })
      .from(userPositions)
      .where(eq(userPositions.userId, userId)),
  ]);
  return {
    isDriver: driver.length > 0,
    positions: normalisePositions(positions.map((p) => ({ position: p.position as PositionDesignation, siteId: p.siteId }))),
  };
}

export async function setDriverFlag(userId: number, isDriver: boolean, actorUserId: number): Promise<void> {
  const database = await db.getDb();
  if (!database) throw new Error("Database not available");
  if (isDriver) {
    await database
      .insert(fleetDrivers)
      .values({ userId, flaggedByUserId: actorUserId })
      .onConflictDoNothing({ target: fleetDrivers.userId });
  } else {
    await database.delete(fleetDrivers).where(eq(fleetDrivers.userId, userId));
  }
}

export type PositionConflict = PositionAssignment & { holderUserId: number; holderName: string | null };

/** The match for one assignment: the org-wide row for the position, or the Branch Secretary row at that site. */
function slotCondition(p: PositionAssignment) {
  return and(
    eq(userPositions.position, p.position),
    p.siteId == null ? isNull(userPositions.siteId) : eq(userPositions.siteId, p.siteId)
  );
}

/** Other users already holding any of `positions` (one holder per position, migration 0061). */
export async function findPositionConflicts(
  userId: number,
  positions: PositionAssignment[]
): Promise<PositionConflict[]> {
  if (!positions.length) return [];
  const database = await db.getDb();
  if (!database) throw new Error("Database not available");
  const rows = await database
    .select({
      position: userPositions.position,
      siteId: userPositions.siteId,
      holderUserId: userPositions.userId,
      holderName: users.name,
    })
    .from(userPositions)
    .innerJoin(users, eq(userPositions.userId, users.id))
    .where(and(ne(userPositions.userId, userId), or(...positions.map(slotCondition))));
  return rows.map((r) => ({ ...r, position: r.position as PositionDesignation }));
}

/**
 * Replace a user's positions with `positions` (already normalised). With `reassign`, first remove the
 * listed conflicts from their current holders, in the same transaction.
 */
export async function replaceUserPositions(
  userId: number,
  positions: PositionAssignment[],
  actorUserId: number,
  reassign: PositionConflict[] = []
): Promise<void> {
  const database = await db.getDb();
  if (!database) throw new Error("Database not available");
  await database.transaction(async (tx) => {
    for (const c of reassign) {
      await tx.delete(userPositions).where(and(eq(userPositions.userId, c.holderUserId), slotCondition(c)));
    }
    await tx.delete(userPositions).where(eq(userPositions.userId, userId));
    if (positions.length) {
      await tx.insert(userPositions).values(
        positions.map((p) => ({ userId, position: p.position, siteId: p.siteId, assignedByUserId: actorUserId }))
      );
    }
  });
}

/**
 * Active users holding `position`. For Branch Secretary pass the branch's siteId. Used by the later fleet
 * waves to address alerts, booking approval and the monthly report.
 */
export async function getPositionHolders(position: PositionDesignation, siteId?: number) {
  const database = await db.getDb();
  if (!database) return [];
  const siteCond = isPerBranchPosition(position)
    ? siteId != null
      ? eq(userPositions.siteId, siteId)
      : undefined
    : isNull(userPositions.siteId);
  return database
    .select({ id: users.id, name: users.name, email: users.email, siteId: userPositions.siteId })
    .from(userPositions)
    .innerJoin(users, eq(userPositions.userId, users.id))
    .where(and(eq(userPositions.position, position), siteCond, eq(users.status, "active")))
    .orderBy(asc(users.name));
}

/** Remove the driver flag. Returns true when a flag was removed. */
export async function clearDriverFlag(userId: number): Promise<boolean> {
  const database = await db.getDb();
  if (!database) return false;
  const removed = await database
    .delete(fleetDrivers)
    .where(eq(fleetDrivers.userId, userId))
    .returning({ userId: fleetDrivers.userId });
  return removed.length > 0;
}

/** Active users flagged as drivers, optionally at one facility. Only these can go on a booking or trip. */
export async function listFlaggedDrivers(siteId?: number) {
  const database = await db.getDb();
  if (!database) return [];
  return database
    .select({ id: users.id, name: users.name, email: users.email, siteId: users.siteId })
    .from(fleetDrivers)
    .innerJoin(users, eq(fleetDrivers.userId, users.id))
    .where(
      and(eq(users.status, "active"), siteId != null ? eq(users.siteId, siteId) : undefined)
    )
    .orderBy(asc(users.name));
}

/** True when every id is an active user flagged as a driver (for the booking and trip writes in later waves). */
export async function areFlaggedDrivers(userIds: number[]): Promise<boolean> {
  if (!userIds.length) return true;
  const database = await db.getDb();
  if (!database) return false;
  const rows = await database
    .select({ id: users.id })
    .from(fleetDrivers)
    .innerJoin(users, eq(fleetDrivers.userId, users.id))
    .where(and(inArray(fleetDrivers.userId, userIds), eq(users.status, "active")));
  return new Set(rows.map((r) => r.id)).size === new Set(userIds).size;
}
