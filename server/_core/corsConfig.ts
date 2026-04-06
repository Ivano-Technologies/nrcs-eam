import type { CorsOptions } from "cors";

const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:5173"] as const;

/** Split CORS_ORIGINS by comma, trim, drop empties. Never returns "*". */
export function parseCorsOriginsEnv(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "*");
}

export function getAllowedOriginsList(): string[] {
  const fromEnv = parseCorsOriginsEnv();
  if (process.env.NODE_ENV !== "production") {
    return Array.from(new Set([...fromEnv, ...DEV_ORIGINS]));
  }
  return fromEnv;
}

export function createCorsMiddlewareOptions(allowedOrigins: string[]): CorsOptions {
  return {
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  };
}

export function logCorsStartup(allowedOrigins: string[]): void {
  const line =
    allowedOrigins.length > 0
      ? allowedOrigins.join(", ")
      : "(none configured)";
  console.log(`[CORS] Allowed origins: ${line}`);

  if (process.env.NODE_ENV === "production" && parseCorsOriginsEnv().length === 0) {
    console.warn(
      "[CORS] CORS_ORIGINS is empty — browser requests sending an Origin header (e.g. SPA on another domain) will be rejected. Set CORS_ORIGINS to your CloudFront/custom URLs."
    );
  }
}
