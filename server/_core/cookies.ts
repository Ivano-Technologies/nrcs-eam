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

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const explicitDomain = process.env.SESSION_COOKIE_DOMAIN?.trim();
  const domain =
    explicitDomain && explicitDomain.length > 0 ? explicitDomain : undefined;

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
