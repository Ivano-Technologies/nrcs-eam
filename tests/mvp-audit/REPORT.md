# MVP Audit — Final Report

**Pass rate (this CI/sandbox run):** 1 / 44 (smoke only).  
**Target on your machine (MySQL + Mailpit):** 44 / 44 (100%).

**Run date:** 2026-04-07  
**Playwright:** see `package.json` → `@playwright/test`  
**Blockers here:** `DATABASE_URL` host returned `connect ETIMEDOUT` / `SELECT 1` failed; Mailpit not running (`ECONNREFUSED` on `:8025`).

---

## Step 0 — Environment (local Windows)

1. **DB:** `pnpm run db:check` — must print `DB OK`.  
   Script: [`scripts/db-check.ts`](../../scripts/db-check.ts) (`getDb()` + `SELECT 1`).
2. **Seed:** `pnpm db:seed` then `pnpm exec tsx scripts/db/seed-e2e.ts` — both exit 0.
3. **Mailpit:** `npx mailpit` (SMTP `127.0.0.1:1025`, UI `http://127.0.0.1:8025`).  
   Email tests use **`127.0.0.1`** for the Mailpit API so Playwright does not hit IPv6 `::1` only.
4. **Health:** `curl http://127.0.0.1:3000/health` → `{"ok":true}` (or rely on Playwright `webServer`).

---

## Fixes applied in this iteration (app / tests)

| Issue | Fix |
|--------|-----|
| Auth tests assumed session without re-login | [`auth.spec.ts`](specs/auth.spec.ts): `beforeEach` runs `seed-e2e` + magic-link login for all tests except “protected route”; that test skips login. |
| Dashboard `afterEach` crashed when seed failed | [`dashboard.spec.ts`](specs/dashboard.spec.ts): create `guard` + `attachGuards` **before** `seedE2E()`. |
| Mailpit API `ECONNREFUSED ::1:8025` | [`email.spec.ts`](specs/email.spec.ts): Mailpit base URL `http://127.0.0.1:8025`. |
| Wrong DB one-liner in prompts | Added `pnpm run db:check` → [`scripts/db-check.ts`](../../scripts/db-check.ts). |

---

## Feature status (after local green run — fill in)

| Module | Feature | Status | Screenshot |
|--------|---------|--------|------------|
| Smoke | GET /health | Run locally | — |
| Auth | Magic link, session, logout, guard | Run locally | `auth-*.png` |
| Dashboard | 2b suite | Run locally | `dashboard-*.png` |
| Assets | CRUD | Run locally | `asset-*.png` |
| Entity pages | Route smoke | Run locally | `entity-*-loaded.png` |
| PDF | 5 report types | Run locally | `report-*.pdf`, `pdf-*-success.png` |
| Email | Magic link + bulk | Run locally | `email-*.png` |
| Settings | Widgets + notifications | Run locally | `settings-*.png` |
| Errors | Validation, 404, unauth | Run locally | `error-*.png` |

---

## Full suite command

```powershell
cd C:\Antigravity\Projects\nrcs-eam
pnpm db:check
pnpm db:seed
pnpm exec tsx scripts/db/seed-e2e.ts
# Terminal: npx mailpit
pnpm test:e2e --reporter=list
```

---

## Screenshots

Run after green suite:

```powershell
Get-ChildItem -Recurse tests\mvp-audit\screenshots | Select-Object Name, Length | Format-Table
```

---

## Bugs found and fixed (session log)

See table **Fixes applied in this iteration** above; add rows here when you complete the local fix loop.
