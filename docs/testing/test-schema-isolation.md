# Playwright Test Schema Isolation

## Overview

Playwright E2E runs use a dedicated PostgreSQL schema (`test`) so test setup and teardown never mutate records in `public`.

## Flow

1. `scripts/db/setup-test-schema.ts` creates `test` schema if missing.
2. The same script mirrors every `public` base table into `test` with `CREATE TABLE IF NOT EXISTS ... (LIKE ... INCLUDING ALL)`.
3. `tests/mvp-audit/auth.setup.ts` calls `setupTestSchema()` before running `seed-e2e`.
4. Seed/auth helpers set `search_path` to `SUPABASE_TEST_SCHEMA` (default `test`) before Supabase DB work.
5. `tests/teardown/global.teardown.ts` truncates test tables and deletes `playwright_*` auth users after suite execution.

## Environment

Use `.env.test` (local) or `.env.test.example` template:

- `SUPABASE_TEST_SCHEMA=test`
- `E2E_USER_EMAIL=playwright_admin@nrcseam.techivano.com`
- `E2E_USER_PASSWORD=PlaywrightTest@2026`

## Safety Nets

- Seeded identities use `playwright_*` email prefix and `[TEST]` display-name prefix.
- Email sending is stubbed when `SUPABASE_TEST_SCHEMA=test`, preventing live Resend traffic during E2E runs.
