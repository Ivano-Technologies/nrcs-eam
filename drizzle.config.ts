import { defineConfig } from "drizzle-kit";
import { getDrizzleMysqlCredentials } from "./drizzle/mysqlCredentials";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: getDrizzleMysqlCredentials(),
});
