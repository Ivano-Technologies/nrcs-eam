import bcrypt from "bcrypt";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { toPublicUser } from "../_core/sanitizeUser";
import { publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { adminProcedure } from "./roleProcedures";

/** Same JWT lifetime as magic-link verification (`server/_core/magicLinkVerification.ts`). */
const PASSWORD_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Auth procedures — kept in a dedicated module so the App Runner bundle always
 * includes password login alongside signup / magic link (clear dependency tree).
 */
export const authRouter = router({
  me: publicProcedure.query(opts =>
    opts.ctx.user ? toPublicUser(opts.ctx.user) : null
  ),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1),
        designation: z.string().min(1),
        department: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const allowedDomains = [
        "redcross.org",
        "nrcs.gov.ng",
        "gmail.com",
        "outlook.com",
        "yahoo.com",
      ];
      const emailDomain = input.email.split("@")[1];
      if (!allowedDomains.includes(emailDomain)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Email domain @${emailDomain} is not allowed. Please contact your administrator.`,
        });
      }
      const openRegistration = await db.getOpenRegistration();
      if (openRegistration) {
        const { createUserDirectSignup } = await import("../magicLinkAuth");
        return await createUserDirectSignup(input.email, input.name, "user", {
          designation: input.designation,
          department: input.department,
        });
      }
      const { createSignupRequest } = await import("../magicLinkAuth");
      return await createSignupRequest(input.email, input.name, "user", {
        designation: input.designation,
        department: input.department,
      });
    }),
  requestMagicLink: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await db.getUserByEmail(input.email);
      if (!user) {
        return { success: false, message: "No account found with this email" };
      }
      const { createMagicLinkToken, sendMagicLink } = await import("../magicLinkAuth");
      const token = await createMagicLinkToken(user.id);
      const sent = await sendMagicLink(input.email, token);
      if (sent) {
        return { success: true, message: "Magic link sent to your email" };
      }
      return { success: false, message: "Failed to send magic link" };
    }),
  loginWithPassword: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserByEmailForLogin(input.email);
      if (!user?.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name ?? "",
        expiresInMs: PASSWORD_SESSION_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });
      return { success: true as const };
    }),
  setPassword: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        password: z.string().min(8).max(128),
      })
    )
    .mutation(async ({ input }) => {
      const target = await db.getUserById(input.userId);
      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      await db.updateUser(input.userId, { passwordHash });
      return { success: true as const };
    }),
});
