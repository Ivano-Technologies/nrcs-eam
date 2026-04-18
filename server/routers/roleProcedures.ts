import { protectedProcedure, requireRole } from "../_core/trpc";

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  requireRole(ctx, ["admin"]);
  return next({ ctx });
});

export const managerOrAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  requireRole(ctx, ["manager", "admin"]);
  return next({ ctx });
});

/** Staff, manager, or admin — inventory create/update/transactions (with extra checks on some mutations). */
export const staffOrAboveProcedure = protectedProcedure.use(({ ctx, next }) => {
  requireRole(ctx, ["staff", "manager", "admin"]);
  return next({ ctx });
});
