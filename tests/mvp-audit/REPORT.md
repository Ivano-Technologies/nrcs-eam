# MVP audit report (partial)

## Automated status

| Check | Result |
|-------|--------|
| Playwright installed | OK (`npx playwright install --with-deps`) |
| Smoke `GET /health` | **PASS** (~39s first run incl. browser download) |
| Full route/tRPC/email/PDF matrix | **Deferred** — scaffold in `CHECKLIST.md`, expand incrementally |

## Screenshots

Template: `tests/mvp-audit/screenshots/*.png` — populate as specs grow.

## Infra notes

- **DB**: `DATABASE_URL` + `pnpm db:seed` + `pnpm exec tsx scripts/db/seed-e2e.ts` before deep tests.
- **Mailpit**: `npx mailpit` → set `SMTP_HOST=127.0.0.1` `SMTP_PORT=1025` for local email.
- **SMTP branch**: `server/emailService.ts` uses nodemailer when `SMTP_HOST` set.

## Bugs fixed

- (none in this pass — smoke only)
