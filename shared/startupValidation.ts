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
  const jwt = process.env.JWT_SECRET?.trim();

  if (!db) {
    throw new Error(
      "[startup] Production requires DATABASE_URL (from .env or Secrets Manager JSON)"
    );
  }
  if (!jwt) {
    throw new Error(
      "[startup] Production requires JWT_SECRET (from .env or Secrets Manager JSON)"
    );
  }
}

/**
 * Production: require TLS to MySQL with strict verification + RDS CA bundle
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
  console.log(
    `[startup] Secrets source: ${secrets === "aws" ? "AWS Secrets Manager" : ".env / process env"}`
  );
  console.log(`[startup] TLS: ${tlsLine}`);
}
