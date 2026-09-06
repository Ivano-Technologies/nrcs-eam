/**
 * Hard stop: automated tests and test seeds must never touch production.
 * Production Supabase project ref: gdseyeyedpzyhczvnzug
 */

export const PRODUCTION_SUPABASE_REF = "gdseyeyedpzyhczvnzug";

const REFUSAL_PREFIX = "[test-db-guard]";

export function urlLooksLikeProduction(url: string): boolean {
  return url.toLowerCase().includes(PRODUCTION_SUPABASE_REF);
}

export function assertSafeTestDatabaseUrl(
  url: string | undefined,
  label = "TEST_DATABASE_URL"
): string {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${REFUSAL_PREFIX} Refusing to run tests when NODE_ENV=production. ` +
        `Tests and seed scripts must use a dedicated test database.`
    );
  }

  const trimmed = url?.trim();
  if (!trimmed) {
    throw new Error(
      `${REFUSAL_PREFIX} ${label} is required and must not fall back to DATABASE_URL. ` +
        `Point it at local Postgres (\`supabase start\` or postgres://postgres:postgres@127.0.0.1:5432/nrcs_eam_test) ` +
        `or a dedicated Supabase branch. See CONTRIBUTING.md.`
    );
  }

  if (urlLooksLikeProduction(trimmed)) {
    throw new Error(
      `${REFUSAL_PREFIX} Refusing to run against production Supabase (${PRODUCTION_SUPABASE_REF}). ` +
        `${label} must be a test database, not gdseyeyedpzyhczvnzug.`
    );
  }

  return trimmed;
}

/**
 * Bind DATABASE_URL to the verified test URL so getDb() cannot see production.
 * A production DATABASE_URL in `.env` (used by `pnpm dev`) is overwritten, not used.
 */
export function applyTestDatabaseUrl(): string {
  const url = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL");
  process.env.DATABASE_URL = url;
  return url;
}
