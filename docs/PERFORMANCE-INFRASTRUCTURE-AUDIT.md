# NRCS EAM Performance Infrastructure Audit

**Baseline commit:** `be4ae72`  
**Implementation:** performance infrastructure plan (Phases 0–4)  
**Stack:** Vite + React + Express/tRPC on Vercel, Supabase Postgres (pooler)

## Executive summary

| Dimension | Before | After (this implementation) |
|-----------|--------|------------------------------|
| Caching | React Query 60s only | Reference data 15m stale; dashboard metrics 5m server cache (Upstash or in-memory fallback) |
| Async jobs | 4 inventory crons | + scheduled reports, async job processor crons; `async_jobs` table |
| DB | N+1 waybills/weekly cron | Batched queries; list pagination default 100; migrations `0046`, `0047` |
| Load testing | None | `tests/load/k6/` baseline + peak scripts |
| Observability | PostHog client only | `identifyUser` wired; optional Sentry; tRPC timing logs; cron structured logs |

## Phase 0 — Measure

- **Index verification:** `scripts/db/pg_stat_user_indexes.sql` (run in Supabase SQL Editor; do not auto-DROP).
- **k6:** `tests/load/k6/baseline.js`, `peak.js`.
- **PostHog:** `identifyUser` in `client/src/_core/hooks/useAuth.ts`.
- **Sentry:** optional via `SENTRY_DSN` — `server/_core/sentry.ts`, init in `server/_core/vercelTrpcHandler.ts`.
- **keep-alive:** `api/keep-alive.ts` requires `CRON_SECRET` Bearer; returns **503** on DB failure.

## Phase 1 — Quick wins

- **`waybills.list`:** single `inArray` query for lines (`server/routers/inventoryRouter.ts`).
- **`runWeeklyChecks`:** grouped balance SQL (`server/_core/inventoryAlerts.ts`).
- **Pagination:** `shared/listPagination.ts` on waybills, GRN receipts, requisitions lists.
- **Indexes:** `drizzle/0046_performance_list_indexes.sql`.
- **Cron dedup:** `server/_core/notificationDedup.ts` + daily/weekly/monthly alerts.
- **Import finalize:** idempotent guard when `draft.status === 'finalized'`.

## Phase 2 — Dashboard & cache

- **Dashboard metrics cache:** `server/_core/cache.ts` + 300s TTL in `dashboard.metrics` (`server/routers.ts`).
- **`checkStockThreshold`:** after waybill dispatch and transfer dispatch/receive.
- **Scheduled reports cron:** `api/cron/scheduled-reports.ts` (daily 07:00 UTC).

## Phase 3 — Async queue

- **`async_jobs` table:** `drizzle/0047_async_jobs.sql`, `server/_core/asyncJobs.ts`.
- **Processor cron:** `api/cron/process-jobs.ts` every 15 minutes.
- **Read replica:** evaluate on Supabase Pro when reporting traffic grows (no code change required yet).

## Phase 4 — Observability

- **tRPC timing:** middleware in `server/_core/trpc.ts` (`LOG_SLOW_TRPC=1` for all procedures).
- **SLO starter:** `docs/SLO-ALERTING.md`.
- **OTel hook:** `server/_core/otel.ts` (set `OTEL_EXPORTER_OTLP_ENDPOINT` when ready).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Cron + keep-alive auth (Vercel injects Bearer on crons when set) |
| `SENTRY_DSN` | Server error tracking |
| `POSTHOG_API_KEY` | Server cron events |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Shared dashboard cache |
| `LOG_SLOW_TRPC` | Log all tRPC procedure durations |

## KPI targets (3 months)

| KPI | Target |
|-----|--------|
| `dashboard.metrics` p95 | &lt; 3s |
| `waybills.list` DB round-trips | 2 |
| Weekly cron at 10k settings | &lt; 60s |
| Server errors in Sentry | 100% sampled when DSN set |

## Rollback

- Revert application deploy; run down migrations only after confirming index/table unused.
- Disable new crons in `vercel.json` if job processor causes load.
