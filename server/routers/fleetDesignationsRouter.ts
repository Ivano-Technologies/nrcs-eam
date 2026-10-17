import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../_core/trpc";
import { AUDIT_ACTIONS, logAuditEvent } from "../_core/auditHelper";
import * as db from "../db";
import * as fleetDb from "../fleetDesignationsDb";
import { POSITION_LABELS, POSITION_VALUES } from "../../shared/fleetPositions";
import { adminProcedure } from "./roleProcedures";

/**
 * Fleet Wave 0 (IVA-168): admins assign position designations and the driver flag. Every change is audited
 * with before and after. Positions are job titles, separate from the app role, and grant no extra access.
 */
const MIGRATION_MISSING = "Positions and the driver flag need database migration 0061. Ask your administrator.";

const DRIVER_NOT_ELIGIBLE = "Only active users can be drivers.";

export function conflictMessage(conflicts: fleetDb.PositionConflict[]): string {
  return conflicts
    .map((c) => `${POSITION_LABELS[c.position]} is already held by ${c.holderName ?? `user ${c.holderUserId}`}.`)
    .join(" ");
}

async function withMigrationCheck<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (fleetDb.isMissingTableError(err)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: MIGRATION_MISSING });
    if (fleetDb.isUniqueViolation(err)) {
      throw new TRPCError({ code: "CONFLICT", message: "Someone else was just given this position. Reload and try again." });
    }
    throw err;
  }
}

async function requireUser(id: number) {
  const target = await db.getUserById(id);
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  return target;
}

export const fleetDesignationsRouter = router({
  list: adminProcedure.query(() => fleetDb.listFleetDesignations()),

  setDriver: adminProcedure
    .input(z.object({ userId: z.number().int().positive(), isDriver: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const target = await requireUser(input.userId);
      if (input.isDriver && !fleetDb.isDriverEligible(target)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: DRIVER_NOT_ELIGIBLE });
      }
      return withMigrationCheck(async () => {
        const before = await fleetDb.getUserDesignations(input.userId);
        if (before.isDriver === input.isDriver) return { success: true as const, changed: false };
        await fleetDb.setDriverFlag(input.userId, input.isDriver, ctx.user.id);
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.USER_DRIVER_FLAG,
          entityType: "user",
          entityId: input.userId,
          changes: { before: { isDriver: before.isDriver }, after: { isDriver: input.isDriver } },
          req: ctx.req,
        });
        return { success: true as const, changed: true };
      });
    }),

  setPositions: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        positions: z
          .array(z.object({ position: z.enum(POSITION_VALUES), siteId: z.number().int().positive().nullable().optional() }))
          .max(20),
        /** Move positions held by someone else to this user (both sides are audited). */
        reassign: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const target = await requireUser(input.userId);
      let next: fleetDb.PositionAssignment[];
      try {
        // Branch Secretary defaults to the user's own facility.
        next = fleetDb.normalisePositions(
          input.positions.map((p) => ({ position: p.position, siteId: p.siteId ?? target.siteId ?? null }))
        );
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Branch Secretary needs a facility. Set the user's facility first.",
        });
      }
      return withMigrationCheck(async () => {
        const before = await fleetDb.getUserDesignations(input.userId);
        if (JSON.stringify(before.positions) === JSON.stringify(next)) return { success: true as const, changed: false };
        // One holder per position (Kezie, 17 Oct).
        const conflicts = await fleetDb.findPositionConflicts(input.userId, next);
        if (conflicts.length && !input.reassign) {
          throw new TRPCError({ code: "CONFLICT", message: conflictMessage(conflicts) });
        }
        const holderBefore = new Map<number, fleetDb.PositionAssignment[]>();
        for (const c of conflicts) {
          if (!holderBefore.has(c.holderUserId)) {
            holderBefore.set(c.holderUserId, (await fleetDb.getUserDesignations(c.holderUserId)).positions);
          }
        }
        await fleetDb.replaceUserPositions(input.userId, next, ctx.user.id, conflicts);
        for (const [holderId, positions] of Array.from(holderBefore)) {
          const moved = conflicts.filter((c) => c.holderUserId === holderId);
          const after = positions.filter((p) => !moved.some((m) => m.position === p.position && m.siteId === p.siteId));
          await logAuditEvent({
            userId: ctx.user.id,
            action: AUDIT_ACTIONS.USER_POSITIONS_UPDATE,
            entityType: "user",
            entityId: holderId,
            changes: {
              before: { positions },
              after: { positions: after },
              reassignedToUserId: input.userId,
            },
            req: ctx.req,
          });
        }
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.USER_POSITIONS_UPDATE,
          entityType: "user",
          entityId: input.userId,
          changes: {
            before: { positions: before.positions },
            after: { positions: next },
            ...(conflicts.length
              ? { reassignedFrom: conflicts.map((c) => ({ position: c.position, siteId: c.siteId, userId: c.holderUserId })) }
              : {}),
          },
          req: ctx.req,
        });
        return { success: true as const, changed: true };
      });
    }),
});
