// @ts-nocheck
import type { CookieOptions, Request } from "express";

/** Registrable suffixes that must never be used as a cookie Domain (Public Suffix List). */
const PUBLIC_SUFFIX_COOKIE_DOMAINS = new Set([
  "vercel.app",
  "github.io",
  "pages.dev",
  "netlify.app",
]);

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}

function isPublicSuffixCookieDomain(value: string): boolean {
  return PUBLIC_SUFFIX_COOKIE_DOMAINS.has(value.replace(/^\./, "").toLowerCase());
}

/**
 * Derive the parent domain (e.g. ".techivano.com") from the incoming hostname so
 * session cookies are shared across all subdomains — production and blue staging alike.
 *
 * blue.nrcseam.techivano.com  →  .techivano.com
 * nrcseam.techivano.com       →  .techivano.com
 * *.vercel.app / localhost    →  undefined  (host-only; browsers reject public suffixes)
 *
 * Override at any time by setting SESSION_COOKIE_DOMAIN in Vercel env vars.
 * An explicitly empty SESSION_COOKIE_DOMAIN means host-only (do not derive).
 */
export function deriveParentDomain(req: Request): string | undefined {
  const host = req.hostname; // Express strips port; honours X-Forwarded-Host when trust proxy is set
  if (!host || host === "localhost" || /^[\d.:]+$/.test(host)) return undefined;
  const labels = host.split(".");
  if (labels.length < 2) return undefined;
  const parent = labels.slice(-2).join(".");
  if (isPublicSuffixCookieDomain(parent)) return undefined;
  return "." + parent;
}

export type SessionCookieOptions = Pick<
  CookieOptions,
  "domain" | "httpOnly" | "path" | "sameSite" | "secure"
>;

export function getSessionCookieOptions(req: Request): SessionCookieOptions {
  const rawExplicit = process.env.SESSION_COOKIE_DOMAIN;
  let domain: string | undefined;
  if (rawExplicit !== undefined) {
    const trimmed = rawExplicit.trim();
    domain = trimmed.length > 0 ? trimmed : undefined;
  } else {
    domain = deriveParentDomain(req);
  }

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
