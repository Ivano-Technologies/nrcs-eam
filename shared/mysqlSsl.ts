/**
 * MySQL TLS options for mysql2 + AWS RDS.
 *
 * RDS uses a chain signed by AWS CAs. For production verification, download the
 * [RDS global bundle](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html),
 * set `DATABASE_SSL_CA_PATH`, and `DATABASE_SSL_REJECT_UNAUTHORIZED=true`.
 *
 * Without `DATABASE_SSL_CA_PATH`, only `rejectUnauthorized` is sent (often `false`
 * for dev until the PEM is configured).
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
 * If `DATABASE_SSL_CA_PATH` is set, reads the PEM and includes `ca`.
 */
export function getMysql2SslOptions(): Mysql2SslConfig | undefined {
  if (!isDatabaseSslEnabled()) {
    return undefined;
  }

  const rejectUnauthorized = mysql2SslRejectUnauthorized();
  const caPath = process.env.DATABASE_SSL_CA_PATH?.trim();

  if (caPath) {
    const resolved = path.isAbsolute(caPath)
      ? caPath
      : path.resolve(process.cwd(), caPath);
    const ca = fs.readFileSync(resolved);
    return { rejectUnauthorized, ca };
  }

  return { rejectUnauthorized };
}
