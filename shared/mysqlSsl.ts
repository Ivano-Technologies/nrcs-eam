/**
 * MySQL TLS options for mysql2 + AWS RDS.
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
 * Options for mysql2 `ssl` when `DATABASE_SSL` is on.
 * If `DATABASE_SSL_REJECT_UNAUTHORIZED=true`, `DATABASE_SSL_CA_PATH` must point to a readable PEM (e.g. RDS global-bundle.pem).
 * If `rejectUnauthorized` is false, CA is optional (dev / transitional).
 */
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
