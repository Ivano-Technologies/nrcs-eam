import { afterEach, describe, expect, it } from "vitest";
import {
  PRODUCTION_SUPABASE_REF,
  applyTestDatabaseUrl,
  assertSafeTestDatabaseUrl,
  urlLooksLikeProduction,
} from "../../shared/testDatabaseGuard";

describe("testDatabaseGuard", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalTestUrl = process.env.TEST_DATABASE_URL;
  const originalDbUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalTestUrl === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = originalTestUrl;
    if (originalDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDbUrl;
  });

  it("rejects an empty TEST_DATABASE_URL", () => {
    expect(() => assertSafeTestDatabaseUrl(undefined)).toThrow(/TEST_DATABASE_URL is required/);
    expect(() => assertSafeTestDatabaseUrl("   ")).toThrow(/TEST_DATABASE_URL is required/);
  });

  it("rejects the production Supabase project ref", () => {
    const prod = `postgresql://postgres:x@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?options=project%3D${PRODUCTION_SUPABASE_REF}`;
    expect(urlLooksLikeProduction(prod)).toBe(true);
    expect(() => assertSafeTestDatabaseUrl(`postgresql://postgres.${PRODUCTION_SUPABASE_REF}:x@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`)).toThrow(
      /production Supabase/
    );
  });

  it("rejects NODE_ENV=production", () => {
    process.env.NODE_ENV = "production";
    expect(() =>
      assertSafeTestDatabaseUrl("postgres://postgres:postgres@127.0.0.1:5432/nrcs_eam_test")
    ).toThrow(/NODE_ENV=production/);
  });

  it("accepts a local test URL and binds DATABASE_URL to it", () => {
    process.env.NODE_ENV = "test";
    process.env.TEST_DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/nrcs_eam_test";
    process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/other";
    expect(applyTestDatabaseUrl()).toBe("postgres://postgres:postgres@127.0.0.1:5432/nrcs_eam_test");
    expect(process.env.DATABASE_URL).toBe("postgres://postgres:postgres@127.0.0.1:5432/nrcs_eam_test");
  });
});
