import "@testing-library/jest-dom/vitest";
import { config } from "dotenv";
import { applyTestDatabaseUrl } from "./shared/testDatabaseGuard";

config({ path: ".env" });
applyTestDatabaseUrl();
