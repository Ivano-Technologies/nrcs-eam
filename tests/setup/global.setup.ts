import { config } from "dotenv";
import { applyTestDatabaseUrl } from "../../shared/testDatabaseGuard";

config({ path: ".env" });
config({ path: ".env.e2e" });
applyTestDatabaseUrl();

export default async function globalSetup(): Promise<void> {
  applyTestDatabaseUrl();
}
