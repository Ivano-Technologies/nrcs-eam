import { z } from "zod";
import { authRouter } from "../routers/authRouter";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  /** Introspection for deploy verification (no secrets). */
  authProcedureNames: publicProcedure.query(() => {
    const procedures = (authRouter as { _def?: { procedures?: Record<string, unknown> } })._def
      ?.procedures;
    return {
      names: procedures ? Object.keys(procedures).sort() : [],
    };
  }),

  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
