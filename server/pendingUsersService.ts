import { eq } from "drizzle-orm";
import { pendingUsers, users } from "../drizzle/schema";
import * as db from "./db";
import { getSupabaseServiceRole } from "./_core/supabase";

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
 * Handle signup request — create pending user (admin approval).
 */
export async function createSignupRequest(
  email: string,
  name: string,
  requestedRole: "user" | "manager" = "user",
  opts?: { designation?: string | null; department?: string | null }
): Promise<{ success: boolean; message: string }> {
  const database = await db.getDb();
  if (!database) return { success: false, message: "Database not available" };

  const existingUser = await database
    .select()
    .from(users)
    .where(eq(users.email, email))
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
    .where(eq(pendingUsers.email, email))
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
    email,
    name,
    designation,
    department,
    requestedRole,
    status: "pending",
  });

  return {
    success: true,
    message:
      "Your request will be reviewed by an administrator. You'll receive an email once approved.",
  };
}

async function insertAppUserAfterSupabaseInvite(params: {
  authUserId: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "technician" | "user";
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
    })
    .returning({ id: users.id });

  const userId = inserted?.id;
  if (userId == null || !Number.isFinite(userId)) {
    throw new Error("Failed to create app user row");
  }
  return userId;
}

/**
 * Open registration: create Supabase user (invite email) + app user row.
 */
export async function createUserDirectSignup(
  email: string,
  name: string,
  requestedRole: "user" | "manager" = "user",
  opts?: { designation?: string | null; department?: string | null }
): Promise<{ success: boolean; message: string }> {
  const database = await db.getDb();
  if (!database) return { success: false, message: "Database not available" };

  const existingUser = await database
    .select()
    .from(users)
    .where(eq(users.email, email))
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
    .where(eq(pendingUsers.email, email))
    .limit(1);

  if (existingPending.length > 0) {
    const status = existingPending[0].status;
    if (status === "pending") {
      return {
        success: false,
        message: "Your signup request is pending admin approval",
      };
    }
    if (status === "rejected") {
      return {
        success: false,
        message:
          "Your signup request was rejected. Please contact an administrator.",
      };
    }
  }

  const supabase = getSupabaseServiceRole();
  const redirectTo = `${getFrontendOrigin()}/auth/verify`;
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: name,
      designation: opts?.designation?.trim() ?? null,
      department: opts?.department?.trim() ?? null,
    },
    redirectTo,
  });

  if (error || !data.user) {
    console.error("[createUserDirectSignup] inviteUserByEmail", error);
    return {
      success: false,
      message:
        error?.message ?? "Failed to create account. Please contact support.",
    };
  }

  const role: "user" | "manager" =
    requestedRole === "manager" ? "manager" : "user";

  try {
    await insertAppUserAfterSupabaseInvite({
      authUserId: data.user.id,
      email,
      name,
      role,
      siteId: 1,
    });
  } catch (e) {
    console.error("[createUserDirectSignup] insert app user", e);
    return {
      success: false,
      message: "Failed to finalize account. Please contact support.",
    };
  }

  return {
    success: true,
    message: "Account created! Check your email for a sign-in link from Supabase.",
  };
}

/**
 * Approve pending user: invite on Supabase + insert app user + update pending row.
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

  const supabase = getSupabaseServiceRole();
  const redirectTo = `${getFrontendOrigin()}/auth/verify`;
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(
    pendingUser.email,
    {
      data: { full_name: pendingUser.name },
      redirectTo,
    }
  );

  if (error || !data.user) {
    console.error("[approvePendingUser] inviteUserByEmail", error);
    return {
      success: false,
      message:
        error?.message ?? "Failed to invite user. Check Supabase configuration.",
    };
  }

  const role: "user" | "manager" =
    pendingUser.requestedRole === "manager" ? "manager" : "user";

  let userId: number;
  try {
    userId = await insertAppUserAfterSupabaseInvite({
      authUserId: data.user.id,
      email: pendingUser.email,
      name: pendingUser.name,
      role,
    });
  } catch (e) {
    console.error("[approvePendingUser] insert app user", e);
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

  return {
    success: true,
    message: "User approved; Supabase sent a sign-in link to their email.",
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
