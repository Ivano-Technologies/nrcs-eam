// @ts-nocheck
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./roleProcedures";
import { clearSessionCookies, setSessionCookies } from "../_core/supabaseSession";
import {
  getSupabasePublishableServer,
  getSupabaseSecret,
} from "../_core/supabase";
import { toPublicUser } from "../_core/sanitizeUser";
import * as db from "../db";
import type { InsertUser } from "../../drizzle/schema";
import { createSignupRequest } from "../pendingUsersService";

const emailSchema = z.string().email();
const AVATARS_BUCKET = "avatars";

export const authRouter = router({
  me: publicProcedure.query((opts) =>
    opts.ctx.user ? toPublicUser(opts.ctx.user) : null
  ),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    await clearSessionCookies(ctx.req, ctx.res);
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
      return await createSignupRequest(input.email, input.name, "user", {
        designation: input.designation,
        department: input.department,
      });
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ input }) => {
      const frontend =
        process.env.FRONTEND_ORIGIN?.replace(/\/$/, "") ||
        process.env.VITE_APP_URL?.replace(/\/$/, "") ||
        "http://localhost:3000";
      const supabase = getSupabasePublishableServer();
      const { error } = await supabase.auth.resetPasswordForEmail(input.email.trim(), {
        redirectTo: `${frontend}/reset-password`,
      });
      if (error) {
        console.error("[requestPasswordReset]", error.message);
      }
      // Never reveal account existence; always return success.
      return {
        success: true as const,
        message: "If an account exists for that email, a password reset link has been sent.",
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
      try {
        await db.warmDbConnection();
      } catch (error) {
        console.error("[auth.loginWithPassword] database warm-up failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database temporarily unavailable. Please try again.",
        });
      }

      const appUser = await db.getLoginUserByEmailLowercase(input.email);
      if (!appUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      if (appUser.status === "inactive") {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Your account has been deactivated. Contact your administrator.",
        });
      }

      const supabase = getSupabasePublishableServer();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: input.email.trim(),
        password: input.password,
      });

      if (error) {
        console.error("[auth.loginWithPassword] Supabase signInWithPassword error", {
          message: error.message,
          status: (error as { status?: number }).status,
        });
      }

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
      await db.touchUserLastSignedInById(appUser.id);
      return {
        success: true as const,
        mustChangePasswordOnLogin: appUser.mustChangePasswordOnLogin,
      };
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().max(200).optional(),
        avatarUrl: z.union([z.string().url().max(2048), z.literal("")]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const patch: Partial<InsertUser> = { updatedAt: new Date() };
      if (input.name !== undefined) {
        const trimmed = input.name.trim();
        if (!trimmed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Name cannot be empty",
          });
        }
        patch.name = trimmed;
      }
      if (input.avatarUrl !== undefined) {
        patch.avatarUrl = input.avatarUrl === "" ? null : input.avatarUrl;
      }
      if (Object.keys(patch).length <= 1) {
        return { success: true as const };
      }
      await db.updateUser(ctx.user.id, patch);
      return { success: true as const };
    }),

  uploadAvatar: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1).max(255),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        dataBase64: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = getSupabaseSecret();
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File payload is empty",
        });
      }
      if (bytes.length > 5 * 1024 * 1024) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Image must be 5MB or smaller",
        });
      }

      const { data: existingBucket, error: getBucketError } = await supabase.storage.getBucket(AVATARS_BUCKET);
      if (getBucketError && getBucketError.message && !/not found/i.test(getBucketError.message)) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to access avatars bucket: ${getBucketError.message}`,
        });
      }
      if (!existingBucket) {
        const { error: createBucketError } = await supabase.storage.createBucket(AVATARS_BUCKET, {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        });
        if (createBucketError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to create avatars bucket: ${createBucketError.message}`,
          });
        }
      }

      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `user-${ctx.user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(key, bytes, {
          contentType: input.mimeType,
          upsert: true,
        });
      if (uploadError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Avatar upload failed: ${uploadError.message}`,
        });
      }

      const { data: publicData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(key);
      if (!publicData?.publicUrl) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not resolve uploaded avatar URL",
        });
      }

      return { url: publicData.publicUrl };
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(128),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const u = ctx.user;
      if (!u.email?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Account has no email" });
      }
      if (!u.authUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Password change is not available for this account type",
        });
      }
      const supabase = getSupabasePublishableServer();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: u.email.trim(),
        password: input.currentPassword,
      });
      if (signErr) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Current password is incorrect",
        });
      }
      const admin = getSupabaseSecret();
      const { error } = await admin.auth.admin.updateUserById(u.authUserId, {
        password: input.newPassword,
      });
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }
      await db.clearMustChangePasswordOnLogin(u.id);
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
      const supabase = getSupabaseSecret();
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
      await db.updateUser(input.userId, {
        mustChangePasswordOnLogin: true,
        updatedAt: new Date(),
      });
      return { success: true as const };
    }),
});
