// @ts-nocheck
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./roleProcedures";
import { clearSessionCookies, setSessionCookies } from "../_core/supabaseSession";
import { getSupabaseAnonServer, getSupabaseServiceRole } from "../_core/supabase";
import { toPublicUser } from "../_core/sanitizeUser";
import * as db from "../db";
import {
  createSignupRequest,
  createUserDirectSignup,
} from "../pendingUsersService";

const emailSchema = z.string().email();

export const authRouter = router({
  me: publicProcedure.query((opts) =>
    opts.ctx.user ? toPublicUser(opts.ctx.user) : null
  ),

  logout: publicProcedure.mutation(({ ctx }) => {
    clearSessionCookies(ctx.req, ctx.res);
    return { success: true } as const;
  }),

  signup: publicProcedure
    .input(
      z.object({
        email: emailSchema,
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
      if (!emailDomain || !allowedDomains.includes(emailDomain)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Email domain @${emailDomain ?? "?"} is not allowed. Please contact your administrator.`,
        });
      }
      const openRegistration = await db.getOpenRegistration();
      if (openRegistration) {
        return await createUserDirectSignup(input.email, input.name, "user", {
          designation: input.designation,
          department: input.department,
        });
      }
      return await createSignupRequest(input.email, input.name, "user", {
        designation: input.designation,
        department: input.department,
      });
    }),

  requestMagicLink: publicProcedure
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ input }) => {
      const user = await db.getUserByEmailLowercase(input.email);
      if (!user) {
        return { success: false, message: "No account found with this email" };
      }
      if (!user.authUserId) {
        return {
          success: false,
          message:
            "This account is not linked to the new sign-in system yet. Please contact an administrator.",
        };
      }
      const frontend =
        process.env.FRONTEND_ORIGIN?.replace(/\/$/, "") ||
        process.env.VITE_APP_URL?.replace(/\/$/, "") ||
        "http://localhost:3000";
      const supabase = getSupabaseAnonServer();
      const { error } = await supabase.auth.signInWithOtp({
        email: input.email.trim(),
        options: {
          emailRedirectTo: `${frontend}/auth/verify`,
        },
      });
      if (error) {
        console.error("[requestMagicLink]", error);
        return {
          success: false,
          message: error.message || "Failed to send magic link",
        };
      }
      return {
        success: true,
        message: "Check your email for a sign-in link from Supabase.",
      };
    }),

  loginWithPassword: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const appUser = await db.getUserByEmailLowercase(input.email);
      if (!appUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const supabase = getSupabaseAnonServer();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: input.email.trim(),
        password: input.password,
      });

      if (error || !data.session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const supabaseEmail = data.user.email?.trim().toLowerCase() ?? "";
      const appEmail = appUser.email?.trim().toLowerCase() ?? "";
      if (supabaseEmail && appEmail && supabaseEmail !== appEmail) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Email does not match this account",
        });
      }

      if (data.user.id !== appUser.authUserId && appUser.authUserId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Session does not match this account",
        });
      }

      if (!appUser.authUserId) {
        await db.updateUser(appUser.id, {
          authUserId: data.user.id,
          loginMethod: "supabase",
        });
      }

      setSessionCookies(ctx.req, ctx.res, data.session);
      await db.upsertUser({
        openId: appUser.openId,
        lastSignedIn: new Date(),
      });
      return { success: true as const };
    }),

  verifyOtp: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        token: z.string().min(1),
        type: z.enum(["email", "magiclink", "signup", "recovery", "invite"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = getSupabaseAnonServer();
      const { data, error } = await supabase.auth.verifyOtp({
        email: input.email.trim(),
        token: input.token.trim(),
        type: input.type,
      });
      if (error || !data.session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: error?.message ?? "Invalid or expired code",
        });
      }
      setSessionCookies(ctx.req, ctx.res, data.session);
      return { success: true as const };
    }),

  /**
   * After Supabase redirects with tokens in the URL hash, the client sends them once
   * so we can set httpOnly cookies.
   */
  setSessionFromTokens: publicProcedure
    .input(
      z.object({
        access_token: z.string().min(1),
        refresh_token: z.string().min(1),
        expires_in: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = getSupabaseAnonServer();
      const { data, error } = await supabase.auth.getUser(input.access_token);
      if (error || !data.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid access token",
        });
      }
      const appUser =
        (await db.getUserByAuthUserId(data.user.id)) ??
        (data.user.email
          ? await db.getUserByEmailLowercase(data.user.email)
          : undefined);
      if (!appUser) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No application account for this user",
        });
      }
      setSessionCookies(ctx.req, ctx.res, {
        access_token: input.access_token,
        refresh_token: input.refresh_token,
        expires_in: input.expires_in,
      });
      await db.upsertUser({
        openId: appUser.openId,
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
      if (!target.authUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User has no Supabase account; approve or invite them first",
        });
      }
      const supabase = getSupabaseServiceRole();
      const { error } = await supabase.auth.admin.updateUserById(
        target.authUserId,
        { password: input.password }
      );
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }
      return { success: true as const };
    }),
});
