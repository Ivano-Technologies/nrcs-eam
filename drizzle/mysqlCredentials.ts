/**
 * Shared helpers for Drizzle Kit + mysql2 against local MySQL or AWS RDS (TLS).
 * RDS: set DATABASE_SSL=true and use a standard mysql:// URL (see docs/AWS_RDS.md).
 */

import { getMysql2SslOptions, isDatabaseSslEnabled } from "../shared/mysqlSsl";

export function getDrizzleMysqlCredentials():
  | { url: string }
  | {
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
      ssl: {
        rejectUnauthorized: boolean;
        ca?: string | Buffer;
      };
    } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run drizzle commands");
  }

  if (!isDatabaseSslEnabled()) {
    return { url: connectionString };
  }

  let u: URL;
  try {
    u = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid mysql:// URL when DATABASE_SSL is enabled");
  }
  if (u.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use mysql:// protocol");
  }

  const database = u.pathname.replace(/^\//, "").split("/")[0] ?? "";
  const password = u.password ? decodeURIComponent(u.password) : "";
  const user = decodeURIComponent(u.username);

  const ssl = getMysql2SslOptions();
  if (!ssl) {
    throw new Error("DATABASE_SSL is enabled but TLS options could not be built");
  }

  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user,
    password,
    database,
    ssl,
  };
}
