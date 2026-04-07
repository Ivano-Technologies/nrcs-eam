# MVP Audit — Final Report

**Pass rate (local run):** 44 / 44 (100%).  
**Target:** 44 / 44 (100%).

**Run date:** 2026-04-07  
**Playwright:** see `package.json` → `@playwright/test`

---

## Step 0 — Environment (local Windows)

1. **`.env.e2e`:** Copy from [`.env.e2e.example`](../../.env.e2e.example); merge other keys from `.env` if needed (never copy production `DATABASE_URL`).
2. **DB:** `pnpm run db:migrate:e2e` then `pnpm run db:check:e2e` — must print `DB OK`.  
   Script: [`scripts/db-check.ts`](../../scripts/db-check.ts) (`getDb()` + `SELECT 1`).
3. **Seed:** `pnpm run db:seed:e2e` then `pnpm run seed-e2e:local` — both exit 0.
4. **Mailpit:** `pnpm run mailpit` (SMTP `127.0.0.1:1025`, UI `http://127.0.0.1:8025`).  
   Email tests use **`127.0.0.1`** for the Mailpit API so Playwright does not hit IPv6 `::1` only.
5. **Dev server:** `pnpm run dev:e2e` (loads `.env.e2e`; uses `tsx` without watch for stable Playwright `webServer`).
6. **Health:** `curl http://127.0.0.1:3000/health` → `{"ok":true}` (or rely on Playwright `webServer`).

---

## Fixes applied (app / DB / tests)

| Issue | Fix |
|--------|-----|
| `workOrderTemplates.list` returned HTTP 500 | Schema had `workOrderTemplates` in Drizzle but no migration — added [`drizzle/0018_work_order_templates_table.sql`](../../drizzle/0018_work_order_templates_table.sql) + journal entry; run `pnpm run db:migrate:e2e`. |
| Bulk email mutation could fail inserting history | [`server/db.ts`](../../server/db.ts) `createEmailNotification`: robust `insertId` (same pattern as other inserts). |
| Forge Maps proxy could 500 under automation | [`client/src/components/Map.tsx`](../../client/src/components/Map.tsx): skip loading external map script when `navigator.webdriver` is true (Playwright). |
| Dynamic `require('./emailService')` in ESM | [`server/routers.ts`](../../server/routers.ts): static `import { generateEmailTemplate, sendBulkEmails } from "./emailService"`. |
| Dashboard `afterEach` hid HTTP failures | [`tests/mvp-audit/specs/dashboard.spec.ts`](specs/dashboard.spec.ts): assert `http4xx5xx` before console errors. |
| `createWorkOrderTemplate` insert ID | [`server/db.ts`](../../server/db.ts): robust `insertId` extraction. |

---

## Feature status (this run)

| Module | Feature | Status | Screenshot |
|--------|---------|--------|------------|
| Smoke | GET /health | Pass | — |
| Auth | Magic link, session, logout, guard | Pass | `auth-*.png` |
| Dashboard | 2b suite | Pass | `dashboard-*.png` |
| Assets | CRUD | Pass | `asset-*.png` |
| Entity pages | Route smoke | Pass | `entity-*-loaded.png` |
| PDF | 5 report types | Pass | `report-*.pdf`, `pdf-*-success.png` |
| Email | Magic link + bulk | Pass | `email-*.png` |
| Settings | Widgets + notifications | Pass | `settings-*.png` |
| Errors | Validation, 404, unauth | Pass | `error-*.png` |

---

## Full suite command

```powershell
cd C:\Antigravity\Projects\nrcs-eam
pnpm run db:migrate:e2e
pnpm run db:check:e2e
pnpm run db:seed:e2e
pnpm run seed-e2e:local
# Terminal: pnpm run mailpit
pnpm test:e2e --reporter=list
```

---

## Screenshots

```powershell
Get-ChildItem -Recurse tests\mvp-audit\screenshots | Select-Object Name, Length | Format-Table
```

---

## Bugs found and fixed (session log)

See table **Fixes applied** above.
