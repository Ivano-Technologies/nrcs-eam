// @ts-nocheck
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { pendingUsers, users } from "../drizzle/schema";
import * as db from "./db";
import { getSupabaseServiceRole } from "./_core/supabase";
import { generateEmailTemplate, sendEmail } from "./emailService";

function getFrontendOrigin(): string {
  const fromEnv =
    process.env.FRONTEND_ORIGIN?.replace(/\/$/, "") ||
    process.env.VITE_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[pendingUsers] FRONTEND_ORIGIN or VITE_APP_URL must be set in production"
    );
  }
  return "http://localhost:3000";
}

/**
 * Handle signup request — create pending user only (no Supabase Auth, no email).
 * Admin must approve before an account exists.
 */
export async function createSignupRequest(
  email: string,
  name: string,
  requestedRole: "user" | "manager" = "user",
  opts?: { designation?: string | null; department?: string | null }
): Promise<{ success: boolean; message: string }> {
  const database = await db.getDb();
  if (!database) return { success: false, message: "Database not available" };

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await database
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      success: false,
      message: "An account with this email already exists",
    };
  }

  const existingPending = await database
    .select()
    .from(pendingUsers)
    .where(eq(pendingUsers.email, normalizedEmail))
    .limit(1);

  if (existingPending.length > 0) {
    const status = existingPending[0].status;
    if (status === "pending") {
      return {
        success: false,
        message: "Your signup request is pending admin approval",
      };
    } else if (status === "rejected") {
      return {
        success: false,
        message:
          "Your signup request was rejected. Please contact an administrator.",
      };
    }
  }

  const designation = opts?.designation?.trim() || null;
  const department = opts?.department?.trim() || null;

  await database.insert(pendingUsers).values({
    email: normalizedEmail,
    name: name.trim(),
    designation,
    department,
    requestedRole,
    status: "pending",
  });

  return {
    success: true,
    message:
      "Access request submitted! An administrator will review your request and you will be notified once your account is approved.",
  };
}

async function insertAppUserAfterSupabaseInvite(params: {
  authUserId: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "staff" | "user";
  siteId?: number | null;
}): Promise<number> {
  const database = await db.getDb();
  if (!database) throw new Error("Database not available");

  const [inserted] = await database
    .insert(users)
    .values({
      openId: params.authUserId,
      authUserId: params.authUserId,
      name: params.name,
      email: params.email,
      loginMethod: "supabase",
      role: params.role,
      siteId: params.siteId ?? null,
      hasCompletedOnboarding: true,
      mustChangePasswordOnLogin: true,
    })
    .returning({ id: users.id });

  const userId = inserted?.id;
  if (userId == null || !Number.isFinite(userId)) {
    throw new Error("Failed to create app user row");
  }
  return userId;
}

/**
 * Approve pending user: create Supabase Auth user with temporary password,
 * insert app user row, notify by email (Resend/SMTP), update pending row.
 */
export async function approvePendingUser(
  pendingUserId: number,
  approvedBy: number
): Promise<{ success: boolean; message: string; userId?: number }> {
  const database = await db.getDb();
  if (!database) return { success: false, message: "Database not available" };

  const pending = await database
    .select()
    .from(pendingUsers)
    .where(eq(pendingUsers.id, pendingUserId))
    .limit(1);

  if (pending.length === 0) {
    return { success: false, message: "Pending user not found" };
  }

  const pendingUser = pending[0];

  if (pendingUser.status !== "pending") {
    return {
      success: false,
      message: "This request has already been processed",
    };
  }

  const email = pendingUser.email.trim().toLowerCase();
  const supabase = getSupabaseServiceRole();
  const tempPassword = randomBytes(18).toString("base64url").slice(0, 24);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: pendingUser.name },
  });

  if (error || !data.user) {
    console.error("[approvePendingUser] createUser", error);
    return {
      success: false,
      message:
        error?.message ??
        "Failed to create auth user. They may already exist in Authentication — remove the duplicate and try again.",
    };
  }

  const role: "user" | "manager" =
    pendingUser.requestedRole === "manager" ? "manager" : "user";

  let userId: number;
  try {
    userId = await insertAppUserAfterSupabaseInvite({
      authUserId: data.user.id,
      email,
      name: pendingUser.name,
      role,
    });
  } catch (e) {
    console.error("[approvePendingUser] insert app user", e);
    try {
      await supabase.auth.admin.deleteUser(data.user.id);
    } catch {
      /* best effort rollback */
    }
    return { success: false, message: "Failed to create user account" };
  }

  await database
    .update(pendingUsers)
    .set({
      status: "approved",
      approvedBy,
      approvedAt: new Date(),
    })
    .where(eq(pendingUsers.id, pendingUserId));

  const origin = getFrontendOrigin();
  const loginUrl = `${origin}/login`;
  const body = `
    <p>Your access request for <strong>NRCS EAM</strong> has been approved.</p>
    <p>You can sign in with your email and the temporary password below, then change your password after login.</p>
    <p><strong>Sign in:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
    <p><strong>Temporary password:</strong> <code style="font-size:16px">${tempPassword}</code></p>
  `;
  const sent = await sendEmail({
    to: email,
    subject: "NRCS EAM — Your account is approved",
    html: generateEmailTemplate(body, "Account approved"),
  });
  if (!sent) {
    console.warn(
      "[approvePendingUser] User created but welcome email was not sent (configure RESEND_API_KEY or SMTP)"
    );
  }

  return {
    success: true,
    message: sent
      ? "User approved. They received an email with sign-in instructions."
      : "User approved. Email could not be sent — share the temporary password with them manually or configure email.",
    userId,
  };
}

export async function rejectPendingUser(
  pendingUserId: number,
  rejectedBy: number,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const database = await db.getDb();
  if (!database) return { success: false, message: "Database not available" };

  await database
    .update(pendingUsers)
    .set({
      status: "rejected",
      approvedBy: rejectedBy,
      approvedAt: new Date(),
      rejectionReason: reason,
    })
    .where(eq(pendingUsers.id, pendingUserId));

  return { success: true, message: "User request rejected" };
}
