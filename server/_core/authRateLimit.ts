import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";

const RATE_LIMIT_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";

function getTrpcProcedurePath(req: Request): string | null {
  const path = req.originalUrl.split("?")[0] ?? "";
  const marker = "/api/trpc/";
  const idx = path.indexOf(marker);
  if (idx === -1) return null;
  return path.slice(idx + marker.length);
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
  const procedure = getTrpcProcedurePath(req);
  if (!procedure) {
    next();
    return;
  }

  if (procedure === "auth.loginWithPassword") {
    loginLimiter(req, res, next);
    return;
  }

  if (procedure === "auth.signup" || procedure === "auth.requestPasswordReset") {
    signupAndResetLimiter(req, res, next);
    return;
  }

  next();
}
