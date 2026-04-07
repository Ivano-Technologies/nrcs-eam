# MVP audit report

## Step 2a — Authentication (`specs/auth.spec.ts`)

| Check | Status |
|-------|--------|
| Spec file created | Done |
| `data-testid="user-menu-trigger"` on user menu | Added in `DashboardLayout.tsx` |
| Pre-flight `pnpm db:seed` + `seed-e2e` | **Required** — must reach MySQL (`DATABASE_URL`) |
| Playwright run in this environment | **Blocked** — DB `ETIMEDOUT` (no local RDS) |

Run locally (after pre-flight):

```bash
pnpm test:e2e tests/mvp-audit/specs/auth.spec.ts
```

Expected screenshots (when green):

- `tests/mvp-audit/screenshots/auth-login-success.png`
- `tests/mvp-audit/screenshots/auth-logout.png`

## Smoke

| Check | Status |
|-------|--------|
| `GET /health` | Pass (`smoke.spec.ts`) |
