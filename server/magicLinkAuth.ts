import crypto from "crypto";
import * as db from "./db";
import { sendEmail } from "./emailService";
import { authTokens, pendingUsers, users } from "../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";

const MAGIC_LINK_EXPIRY_MINUTES = 15;
const BASE_URL = process.env.VITE_APP_URL || "http://localhost:3000";

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a magic link token for a user
 */
export async function createMagicLinkToken(userId: number): Promise<string> {
  const database = await db.getDb();
  if (!database) throw new Error("Database not available");

  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

  await database.insert(authTokens).values({
    userId,
    token,
    type: "magic_link",
    expiresAt,
  });

  return token;
}

/**
 * Verify and consume a magic link token
 */
export async function verifyMagicLinkToken(token: string): Promise<number | null> {
  const database = await db.getDb();
  if (!database) return null;

  // Find unused, non-expired token
  const result = await database
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.token, token),
        eq(authTokens.type, "magic_link"),
        gt(authTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (result.length === 0 || !result[0].userId) return null;

  const authToken = result[0];

  // Check if already used
  if (authToken.usedAt) return null;

  // Mark token as used
  await database
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, authToken.id));

  return authToken.userId;
}

/**
 * Send magic link email to user
 */
export async function sendMagicLink(email: string, token: string): Promise<boolean> {
  const magicLink = `${BASE_URL}/auth/verify?token=${token}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1E3A8A; margin: 0;">Nigerian Red Cross Society</h1>
        <p style="color: #666; margin: 5px 0 0 0;">Enterprise Asset Management</p>
      </div>
      
      <div style="background: #f8f9fa; border-radius: 8px; padding: 30px; margin: 20px 0;">
        <h2 style="color: #333; margin-top: 0;">Sign in to your account</h2>
        <p style="color: #666; line-height: 1.6;">
          Click the button below to sign in to your NRCS EAM account. This link will expire in ${MAGIC_LINK_EXPIRY_MINUTES} minutes.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLink}" 
             style="background: #1E3A8A; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
            Sign In
          </a>
        </div>
        
        <p style="color: #999; font-size: 14px; margin-top: 30px;">
          If you didn't request this email, you can safely ignore it.
        </p>
      </div>
      
      <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
        <p>Nigerian Red Cross Society - Enterprise Asset Management System</p>
      </div>
    </div>
  `;

  return await sendEmail({
    to: email,
    subject: "Sign in to NRCS EAM",
    html: htmlBody,
  });
}

/**
 * Handle signup request - create pending user
 */
export async function createSignupRequest(
  email: string,
  name: string,
  requestedRole: "user" | "manager" = "user"
): Promise<{ success: boolean; message: string }> {
  const database = await db.getDb();
  if (!database) return { success: false, message: "Database not available" };

  // Check if user already exists
  const existingUser = await database
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    return { success: false, message: "An account with this email already exists" };
  }

  // Check if pending request exists
  const existingPending = await database
    .select()
    .from(pendingUsers)
    .where(eq(pendingUsers.email, email))
    .limit(1);

  if (existingPending.length > 0) {
    const status = existingPending[0].status;
    if (status === "pending") {
      return { success: false, message: "Your signup request is pending admin approval" };
    } else if (status === "rejected") {
      return { success: false, message: "Your signup request was rejected. Please contact an administrator." };
    }
  }

  // Create pending user
  await database.insert(pendingUsers).values({
    email,
    name,
    requestedRole,
    status: "pending",
  });

  // Notify admins (optional - can be implemented later)
  // await notifyAdminsOfNewSignup(email, name);

  return {
    success: true,
    message: "Signup request submitted successfully. An administrator will review your request.",
  };
}

/**
 * Approve a pending user and create their account
 */
export async function approvePendingUser(
  pendingUserId: number,
  approvedBy: number
): Promise<{ success: boolean; message: string; userId?: number }> {
  const database = await db.getDb();
  if (!database) return { success: false, message: "Database not available" };

  // Get pending user
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
    return { success: false, message: "This request has already been processed" };
  }

  // Create user account
  const result: any = await database.insert(users).values({
    openId: `magic_${crypto.randomBytes(16).toString("hex")}`,
    name: pendingUser.name,
    email: pendingUser.email,
    loginMethod: "magic_link",
    role: pendingUser.requestedRole === "manager" ? "manager" : "user",
  });

  const userId = Number(result.insertId);

  // Update pending user status
  await database
    .update(pendingUsers)
    .set({
      status: "approved",
      approvedBy,
      approvedAt: new Date(),
    })
    .where(eq(pendingUsers.id, pendingUserId));

  // Send approval email with magic link
  const token = await createMagicLinkToken(userId);
  await sendMagicLink(pendingUser.email, token);

  return {
    success: true,
    message: "User approved and magic link sent",
    userId,
  };
}

/**
 * Reject a pending user
 */
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
