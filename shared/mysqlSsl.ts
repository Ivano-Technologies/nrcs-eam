/**
 * Database TLS options for postgres.js + AWS RDS / Supabase.
 *
 * When `DATABASE_SSL_REJECT_UNAUTHORIZED=true`, `DATABASE_SSL_CA_PATH` must point to the
 * [RDS global bundle](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)
 * (e.g. `./certs/global-bundle.pem`). Build runs `scripts/fetch-rds-ca.mjs` if the file is missing.
 *
 * When `rejectUnauthorized` is false (dev), CA is optional; if `DATABASE_SSL_CA_PATH` is set,
 * the file must exist.
 */

import fs from "fs";
import path from "path";
import type postgres from "postgres";

export function isDatabaseSslEnabled(): boolean {
  const v = process.env.DATABASE_SSL;
  return v === "true" || v === "1";
}

/**
 * Strict TLS verification (use with AWS RDS CA bundle in production).
 * Must use === "true" only — do not use truthy checks: the string "false" is truthy in JS.
 */
export function mysql2SslRejectUnauthorized(): boolean {
  return process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";
}

export type Mysql2SslConfig = {
  rejectUnauthorized: boolean;
  ca?: string | Buffer;
};

/**
 * Options for mysql2 `ssl` when `DATABASE_SSL` is on (legacy name; used for CA loading).
 * If `DATABASE_SSL_REJECT_UNAUTHORIZED=true`, `DATABASE_SSL_CA_PATH` must point to a readable PEM (e.g. RDS global-bundle.pem).
 * If `rejectUnauthorized` is false, CA is optional (dev / transitional).
 */

/**
 * SSL option for the `postgres` npm package (non-local hosts).
 * When `DATABASE_SSL` is unset, returns `{ rejectUnauthorized: false }` for remote URLs
 * so Supabase/Postgres TLS still works without a CA bundle.
 */
export type PostgresJsSslOption =
  | undefined
  | false
  | "require"
  | { rejectUnauthorized: boolean; ca?: string | Buffer };

export function isSupabaseDatabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("supabase.co") || host.includes("pooler.supabase.com");
  } catch {
    return false;
  }
}

export function isServerlessRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.VERCEL_ENV) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)
  );
}

export function getPostgresJsSslOption(): PostgresJsSslOption {
  /** Same idea as libpq `sslmode=disable` — use for VPC-private Postgres when TLS is not spoken on the socket. */
  if (process.env.POSTGRES_SSLMODE === "disable") {
    return false;
  }
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  let host = "";
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    host = h;
    if (h === "localhost" || h === "127.0.0.1" || h === "::1") {
      return undefined;
    }
  } catch {
    return undefined;
  }

  // Supabase (especially Transaction pooler on :6543) requires TLS.
  if (host.includes("supabase.co") || host.includes("pooler.supabase.com")) {
    return "require";
  }

  const strict = getMysql2SslOptions();
  if (strict) {
    return {
      rejectUnauthorized: strict.rejectUnauthorized,
      ca: strict.ca,
    };
  }

  return { rejectUnauthorized: false };
}

export function getMysql2SslOptions(): Mysql2SslConfig | undefined {
  if (!isDatabaseSslEnabled()) {
    return undefined;
  }

  const rejectUnauthorized = mysql2SslRejectUnauthorized();
  const caPath = process.env.DATABASE_SSL_CA_PATH?.trim();

  if (rejectUnauthorized) {
    if (!caPath) {
      throw new Error(
        "Strict TLS enabled but DATABASE_SSL_CA_PATH not set. " +
          "Provide path to RDS CA bundle (e.g., ./certs/global-bundle.pem). See certs/README.md"
      );
    }
    const resolved = path.isAbsolute(caPath)
      ? caPath
      : path.resolve(process.cwd(), caPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(
        `DATABASE_SSL_CA_PATH file not found: ${resolved}`
      );
    }
    const ca = fs.readFileSync(resolved);
    return { rejectUnauthorized: true, ca };
  }

  if (caPath) {
    const resolved = path.isAbsolute(caPath)
      ? caPath
      : path.resolve(process.cwd(), caPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(
        `DATABASE_SSL_CA_PATH file not found: ${resolved}`
      );
    }
    const ca = fs.readFileSync(resolved);
    return { rejectUnauthorized: false, ca };
  }

  return { rejectUnauthorized: false };
}

/** Shared postgres.js pool options (Supabase Transaction pooler + Vercel serverless). */
export function getPostgresJsPoolOptions(
  databaseUrl: string = process.env.DATABASE_URL ?? ""
): NonNullable<Parameters<typeof postgres>[1]> {
  const ssl = getPostgresJsSslOption();
  const supabase = isSupabaseDatabaseUrl(databaseUrl);
  const serverless = isServerlessRuntime();
  const e2eSchema = process.env.SUPABASE_TEST_SCHEMA?.trim();

  const options: NonNullable<Parameters<typeof postgres>[1]> = {
    // Required for Supabase Transaction pooler (port 6543); prepared statements fail silently.
    prepare: false,
    max:
      serverless || supabase
        ? 3
        : Number(process.env.DB_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: serverless ? 10 : 30,
    // Recycle connections on warm serverless instances (e.g. after DATABASE_URL password change).
    ...(serverless ? { max_lifetime: 60 * 30 } : {}),
    ...(e2eSchema
      ? {
          connection: {
            search_path: `${e2eSchema},public`,
          },
        }
      : {}),
  };

  if (ssl === false) {
    options.ssl = false;
  } else if (ssl === "require") {
    options.ssl = "require";
  } else if (ssl !== undefined) {
    options.ssl = ssl;
  } else if (supabase) {
    options.ssl = "require";
  }

  return options;
}
