import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";

const RATE_LIMIT_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";

const TRPC_PATH_MARKER = "/api/trpc/";

const LOGIN_PROCEDURE = "auth.loginWithPassword";
const SIGNUP_AND_RESET_PROCEDURES = new Set([
  "auth.signup",
  "auth.requestPasswordReset",
]);

/** Exported for unit tests — parses single or comma-separated tRPC procedure paths. */
export function extractTrpcProcedures(req: Request): string[] {
  const fromOriginalUrl = extractProceduresFromPath(req.originalUrl);
  if (fromOriginalUrl.length > 0) {
    return fromOriginalUrl;
  }

  // When mounted on `/api/trpc`, Express exposes the relative segment on req.path.
  const relative = req.path.replace(/^\//, "");
  if (relative) {
    return splitProcedureSegment(relative);
  }

  return [];
}

function extractProceduresFromPath(originalUrl: string): string[] {
  const path = originalUrl.split("?")[0] ?? "";
  const idx = path.indexOf(TRPC_PATH_MARKER);
  if (idx === -1) {
    return [];
  }
  return splitProcedureSegment(path.slice(idx + TRPC_PATH_MARKER.length));
}

function splitProcedureSegment(segment: string): string[] {
  if (!segment) {
    return [];
  }
  return segment
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: RATE_LIMIT_MESSAGE },
});

const signupAndResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: RATE_LIMIT_MESSAGE },
});

/**
 * Rate-limit public auth tRPC mutations by procedure path (httpLink URLs).
 * Mount on `/api/trpc` before the tRPC middleware.
 */
export function authTrpcRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const procedures = extractTrpcProcedures(req);
  if (procedures.length === 0) {
    next();
    return;
  }

  if (procedures.includes(LOGIN_PROCEDURE)) {
    loginLimiter(req, res, next);
    return;
  }

  if (procedures.some((procedure) => SIGNUP_AND_RESET_PROCEDURES.has(procedure))) {
    signupAndResetLimiter(req, res, next);
    return;
  }

  next();
}
