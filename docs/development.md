# Development Workflow

## Local setup (final)

1. `pnpm install`
2. `cp .env.example .env`
3. Set required env vars:
   - `DATABASE_URL` (app / `pnpm dev` only)
   - `TEST_DATABASE_URL` (required for `pnpm test`, Playwright, and `seed-db.mjs` — never production)
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
4. Optional integrations:
   - `RESEND_API_KEY` (WMS notifications)
5. Fresh / empty Postgres: `pnpm db:setup` (bootstrap → migrate → seed). On an existing Supabase DB, skip bootstrap and run migrate/seed as needed.
6. Start app: `pnpm dev`

Notes:

- AWS Secrets Manager integration has been removed from runtime bootstrap.
- WMS quantity source of truth is `stock_movements`; avoid adding new `inventory_stock` usage.
- `pnpm db:bootstrap` applies `scripts/db/bootstrap.sql` (existence-guarded; safe if re-run against Supabase/production by accident).

## Running tests in CI and locally

Vitest includes DB-backed router tests (`server/eam.test.ts`, `server/bulkSiteImport.test.ts`, `server/facilityHierarchy.test.ts`, `server/notifications.test.ts`, `server/qrcode.test.ts`). They need a Postgres database reachable via **`TEST_DATABASE_URL`**. Setup refuses to run if that variable is unset or points at production (`gdseyeyedpzyhczvnzug`). It never falls back to `DATABASE_URL`. See CONTRIBUTING.md.

**CI** (`.github/workflows/ci.yml` `test` job):

1. Starts ephemeral `postgres:16` (`nrcs_eam_test`)
2. Runs `pnpm db:bootstrap` twice, then diffs md5 hashes of the four bootstrap-managed function definitions to prove idempotency
3. Runs `pnpm exec drizzle-kit migrate`, then `pnpm exec tsx scripts/db/seed-db.mjs`, then `pnpm exec vitest run`

**Locally:**

```bash
# Point tests at a dedicated Postgres DB (never production)
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/nrcs_eam_test

# Bootstrap + migrate + seed (vanilla Postgres / CI parity)
pnpm db:setup

pnpm exec vitest run
```

`vitest.setup.ts` loads `.env` via dotenv when present, then binds `DATABASE_URL` to `TEST_DATABASE_URL`. CI sets both to the ephemeral `nrcs_eam_test` service. Unit tests that do not touch the DB still require `TEST_DATABASE_URL` so a missing or production URL cannot slip through.

Also run `pnpm lint` (ESLint) and `pnpm check` (TypeScript) before opening a PR. CI enforces all three plus a frontend production build.

## Pre-push Verification

Use `pnpm check:full` before pushing. It runs the full pre-push verification pipeline in order and fails fast on the first error:

1. Type check (`pnpm exec tsc --noEmit`)
2. Project check (`pnpm check`)
3. Clean working tree (`git status --porcelain`)
4. Migration parity between `drizzle/*.sql` and `drizzle/meta/_journal.json`
5. Dev DB migration coverage (`.env`)
6. E2E DB migration coverage (`.env.e2e`)
7. Vitest (`pnpm exec vitest run`)
8. Playwright regression suites (`pnpm exec playwright test --project=mvp-audit --project=live-auth`)

When Playwright fails, `check:full` ignores only the known deferred failures listed per project in `scripts/check/known-failures.json`. Any new failing spec outside that list fails the command.

### Optional skip flags

- `CHECK_FULL_SKIP_PLAYWRIGHT=1` skips the Playwright step.
- `CHECK_FULL_SKIP_E2E_DB=1` skips the `.env.e2e` migration-applied check.

Both skips print explicit warnings in the command output when enabled.

## E2E Auth Environment

`tests/mvp-audit` uses Supabase email+password auth for test execution (with one dedicated magic-link smoke spec).

Required in `.env.e2e`:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `TEST_USER_PASSWORD`

Optional for WMS notifications in local/prod `.env`:

- `RESEND_API_KEY`
