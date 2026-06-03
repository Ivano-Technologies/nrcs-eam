# Read replica evaluation (Supabase Pro)

Use this checklist when dashboard/reporting load competes with transactional API traffic.

## When to consider

- Sustained `dashboard.metrics` p95 &gt; 3s after cache + query tuning
- Reporting cron or WMS exports causing pool wait events on port 6543
- More than ~100 concurrent Vercel function instances hitting Postgres

## Supabase options

1. **Read replica** (Pro): route read-only paths (`dashboard.metrics`, `search.global` aggregates, scheduled report generation) to replica connection string.
2. **Connection pooler**: keep `prepare: false`, `max: 1` on serverless; use higher `DB_POOL_MAX` only on long-running Node (`dist/index.js`).

## Implementation sketch (future PR)

- Add `DATABASE_READ_URL` env.
- `getReadDb()` in `server/db.ts` mirroring `getDb()` with read URL.
- Tag tRPC procedures with `readOnly: true` metadata and select client in middleware.

## What not to move

- Stock mutations, inventory finalize, auth, and cron writes must stay on primary.
