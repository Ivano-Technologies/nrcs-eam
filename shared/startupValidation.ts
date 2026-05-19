import { getSecretsSource } from "./loadSecrets";
import {
  getMysql2SslOptions,
  isDatabaseSslEnabled,
  mysql2SslRejectUnauthorized,
} from "./mysqlSsl";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * After loadSecrets: required vars for any production process.
 */
export function validateProductionSecrets(): void {
  if (!isProduction()) {
    return;
  }

  const db = process.env.DATABASE_URL?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabasePublishable = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!db) {
    throw new Error(
      "[startup] Production requires DATABASE_URL (from .env or Secrets Manager JSON)"
    );
  }
  if (!supabaseUrl || !supabasePublishable || !supabaseSecret) {
    throw new Error(
      "[startup] Production requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY"
    );
  }

  const frontendOrigin =
    process.env.FRONTEND_ORIGIN?.trim() || process.env.VITE_APP_URL?.trim();
  if (!frontendOrigin) {
    throw new Error(
      "[startup] Production requires FRONTEND_ORIGIN or VITE_APP_URL (magic-link links and post-login redirects)"
    );
  }

  if (!process.env.CORS_ORIGINS?.trim()) {
    console.warn(
      "[startup] CORS_ORIGINS is empty — browsers on another origin (e.g. Vercel SPA) cannot call this API until you set it (comma-separated HTTPS origins)."
    );
  }
}

/**
 * Production: require TLS to Postgres with strict verification + RDS CA bundle
 * (same rules whether secrets come from Secrets Manager or plain env).
 */
export function validateAwsProductionTls(): void {
  if (!isProduction()) {
    return;
  }

  if (process.env.DATABASE_SSL !== "true") {
    throw new Error("[startup] Production requires DATABASE_SSL=true");
  }
  if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "true") {
    throw new Error(
      "[startup] Production requires DATABASE_SSL_REJECT_UNAUTHORIZED=true"
    );
  }

  // Same TLS path as server/db + drizzle (throws if CA missing when strict)
  try {
    getMysql2SslOptions();
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export function logStartupSummary(): void {
  const env = process.env.NODE_ENV || "undefined";
  const secrets = getSecretsSource();
  const sslOn = isDatabaseSslEnabled();
  const strict = mysql2SslRejectUnauthorized();
  const caPath = process.env.DATABASE_SSL_CA_PATH?.trim();

  let tlsLine: string;
  if (!sslOn) {
    tlsLine = "disabled";
  } else if (strict) {
    tlsLine = caPath
      ? `enabled (strict) — CA: ${caPath}`
      : "enabled (strict)";
  } else {
    tlsLine = "enabled, relaxed (rejectUnauthorized=false)";
  }

  console.log(`[startup] Environment: ${env}`);
  console.log(`[startup] Secrets source: ${secrets === "env" ? ".env / process env" : "unknown"}`);
  console.log(`[startup] TLS: ${tlsLine}`);
  console.log(
    "[startup] Email provider:",
    process.env.RESEND_API_KEY ? "Resend" : "none"
  );
}
