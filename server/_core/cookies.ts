// @ts-nocheck
import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Derive the parent domain (e.g. ".techivano.com") from the incoming hostname so
 * session cookies are shared across all subdomains — production and blue staging alike.
 *
 * blue.nrcseam.techivano.com  →  .techivano.com
 * nrcseam.techivano.com       →  .techivano.com
 * localhost / 127.0.0.1       →  undefined  (browsers reject domain=.localhost)
 *
 * Override at any time by setting SESSION_COOKIE_DOMAIN in Vercel env vars.
 */
function deriveParentDomain(req: Request): string | undefined {
  const host = req.hostname; // Express strips port; honours X-Forwarded-Host when trust proxy is set
  if (!host || host === "localhost" || /^[\d.:]+$/.test(host)) return undefined;
  const labels = host.split(".");
  if (labels.length < 2) return undefined;
  return "." + labels.slice(-2).join(".");
}

export type SessionCookieOptions = Pick<
  CookieOptions,
  "domain" | "httpOnly" | "path" | "sameSite" | "secure"
>;

export function getSessionCookieOptions(req: Request): SessionCookieOptions {
  const explicitDomain = process.env.SESSION_COOKIE_DOMAIN?.trim();
  const domain =
    explicitDomain && explicitDomain.length > 0
      ? explicitDomain
      : deriveParentDomain(req);

  const secure = isSecureRequest(req);
  // SameSite=None requires Secure; on plain HTTP (local dev) browsers reject that pair. Use lax for same-site cookies.
  return {
    ...(domain ? { domain } : {}),
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
  };
}

/** Options for clearCookie — must match set-cookie attributes; never pass maxAge (Express v5 ignores it). */
export function getClearCookieOptions(req: Request): SessionCookieOptions {
  return getSessionCookieOptions(req);
}
