import { Request, Response } from "express";
import { verifyMagicLinkToken } from "../magicLinkAuth";
import * as db from "../db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

/**
 * Handle magic link verification endpoint
 */
export async function handleMagicLinkVerification(req: Request, res: Response) {
  try {
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Missing verification token",
      });
    }

    // Verify token and get user ID
    const userId = await verifyMagicLinkToken(token);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired magic link",
      });
    }

    // Get user details
    const user = await db.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Same session shape as OAuth (openId / appId / name) so tRPC auth.me works.
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name ?? "",
      expiresInMs: 7 * 24 * 60 * 60 * 1000,
    });

    // Set session cookie
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

    // Update last signed in (optional - can be added to db.ts later)
    // await db.updateUserLastSignedIn(user.id);

    return res.json({
      success: true,
      message: "Successfully authenticated",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Magic link verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Verification failed",
    });
  }
}
