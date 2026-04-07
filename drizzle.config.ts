import * as dotenv from "dotenv";
dotenv.config({ path: ".env.e2e", override: true });
if (!process.env.DATABASE_URL) {
  dotenv.config(); // fallback to .env
}
import { defineConfig } from "drizzle-kit";

function getDrizzleMysqlCredentials() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run drizzle commands");
  }

  let u: URL;
  try {
    u = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid mysql:// URL");
  }
  if (u.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use mysql:// protocol");
  }

  const database = u.pathname.replace(/^\//, "").split("/")[0] ?? "";
  const password = u.password ? decodeURIComponent(u.password) : "";
  const user = decodeURIComponent(u.username);

  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user,
    password,
    database,
  };
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: getDrizzleMysqlCredentials(),
});
