/**
 * MySQL TLS options for mysql2 + AWS RDS.
 *
 * RDS presents a chain signed by AWS CAs; Node may not trust it without the
 * RDS combined CA bundle. Until `DATABASE_SSL_CA_PATH` is set, we default to
 * `rejectUnauthorized: false` when TLS is on so connections succeed.
 *
 * Production: download AWS `global-bundle.pem`, set DATABASE_SSL_CA_PATH, and
 * set DATABASE_SSL_REJECT_UNAUTHORIZED=true (see docs/AWS_RDS.md).
 */

export function isDatabaseSslEnabled(): boolean {
  const v = process.env.DATABASE_SSL;
  return v === "true" || v === "1";
}

/** When false/omitted with TLS, allows RDS without bundling AWS CA (dev / typical RDS). */
export function mysql2SslRejectUnauthorized(): boolean {
  return process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";
}
