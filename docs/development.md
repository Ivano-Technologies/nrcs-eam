# Development Workflow

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
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TEST_USER_PASSWORD`

Optional for WMS notifications in local/prod `.env`:

- `RESEND_API_KEY`
