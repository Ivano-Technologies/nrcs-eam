import { UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

const timingMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;
  if (durationMs >= 2000 || process.env.LOG_SLOW_TRPC === "1") {
    console.info(JSON.stringify({ type: "trpc_timing", path, procedureType: type, durationMs }));
  }
  return result;
});

const baseProcedure = t.procedure.use(timingMiddleware);

export const router = t.router;
export const publicProcedure = baseProcedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = baseProcedure.use(requireUser);

/**
 * Ensures the request is authenticated and the user's role is one of `roles`.
 * @throws TRPCError UNAUTHORIZED when not allowed (matches product requirement for permission failures).
 */
export function requireRole(ctx: TrpcContext, roles: string[]): asserts ctx is TrpcContext & { user: NonNullable<TrpcContext["user"]> } {
  if (!ctx.user || !roles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Insufficient permissions",
    });
  }
}
