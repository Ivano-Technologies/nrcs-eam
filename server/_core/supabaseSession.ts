// @ts-nocheck
import {
  COOKIE_NAME,
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
} from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request, Response } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { getClearCookieOptions, getSessionCookieOptions } from "./cookies";
import { getSupabasePublishableServer } from "./supabase";

function parseCookies(header: string | undefined): Map<string, string> {
  if (!header) {
    return new Map();
  }
  const parsed = parseCookieHeader(header);
  return new Map(Object.entries(parsed));
}

function getBearerToken(req: Request): string | undefined {
  const h = req.headers.authorization;
  if (!h || typeof h !== "string") return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1];
}

export function getAccessTokenFromRequest(req: Request): string | undefined {
  const bearer = getBearerToken(req);
  if (bearer) return bearer;
  return parseCookies(req.headers.cookie).get(SUPABASE_ACCESS_TOKEN_COOKIE);
}

export function getRefreshTokenFromRequest(req: Request): string | undefined {
  return parseCookies(req.headers.cookie).get(SUPABASE_REFRESH_TOKEN_COOKIE);
}

export function setSessionCookies(
  req: Request,
  res: Response,
  session: {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  }
): void {
  const opts = getSessionCookieOptions(req);
  const accessMs = (session.expires_in ?? 3600) * 1000;
  const refreshMs = 1000 * 60 * 60 * 24 * 365;

  res.cookie(SUPABASE_ACCESS_TOKEN_COOKIE, session.access_token, {
    ...opts,
    maxAge: accessMs,
  });
  res.cookie(SUPABASE_REFRESH_TOKEN_COOKIE, session.refresh_token, {
    ...opts,
    maxAge: refreshMs,
  });
}

export async function clearSessionCookies(
  req: Request,
  res: Response
): Promise<void> {
  // Session is httpOnly JWT cookies managed by this app — clearing cookies ends the session.
  // Do not call supabase.auth.signOut() here; it can block ~50s on a network round-trip to Supabase Auth.
  const opts = getClearCookieOptions(req);
  res.clearCookie(SUPABASE_ACCESS_TOKEN_COOKIE, opts);
  res.clearCookie(SUPABASE_REFRESH_TOKEN_COOKIE, opts);
  res.clearCookie(COOKIE_NAME, opts);
}

/**
 * Verify Supabase JWT, resolve app user, optional refresh + cookie rotation.
 */
export async function authenticateRequest(
  req: Request,
  res: Response
): Promise<User> {
  let accessToken = getAccessTokenFromRequest(req);
  const supabase = getSupabasePublishableServer();

  if (!accessToken) {
    const refresh = getRefreshTokenFromRequest(req);
    if (refresh) {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refresh,
      });
      if (!error && data.session) {
        setSessionCookies(req, res, data.session);
        accessToken = data.session.access_token;
      }
    }
  }

  if (!accessToken) {
    throw ForbiddenError("Invalid session cookie");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw ForbiddenError("Invalid session cookie");
  }

  const authId = user.id;
  const emailNorm = user.email?.trim().toLowerCase() ?? "";

  let appUser =
    (await db.getUserByAuthUserId(authId)) ??
    (emailNorm ? await db.getUserByEmailLowercase(emailNorm) : undefined);

  if (!appUser) {
    throw ForbiddenError("User not found");
  }

  if (appUser.authUserId && appUser.authUserId !== authId) {
    throw ForbiddenError("Session does not match this account");
  }

  if (!appUser.authUserId) {
    await db.updateUser(appUser.id, {
      authUserId: authId,
      loginMethod: "supabase",
    });
    const reloaded = await db.getUserById(appUser.id);
    if (reloaded) appUser = reloaded;
  }

  await db.upsertUser({
    openId: appUser.openId,
    lastSignedIn: new Date(),
  });

  return appUser;
}
