import * as dotenv from "dotenv";
dotenv.config({ path: ".env.e2e", override: true });
if (!process.env.DATABASE_URL) {
  dotenv.config(); // fallback to .env
}
// Prefer Postgres URL for Drizzle Kit (e.g. legacy .env.e2e may still point at MySQL).
if (!/^postgres(ql)?:/i.test(process.env.DATABASE_URL ?? "")) {
  dotenv.config({ override: true });
}
import { defineConfig } from "drizzle-kit";

function getDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run drizzle commands");
  }
  return connectionString;
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});
