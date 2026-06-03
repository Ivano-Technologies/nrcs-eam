# SLO and alerting (starter)

Configure these in **Vercel**, **Sentry**, and **Supabase** dashboards. Values align with the performance infrastructure audit.

## Service level indicators

| SLI | Target | Suggested alert |
|-----|--------|-----------------|
| Availability | 99.5% monthly | `/api/health?deep=1` failing for 5 consecutive minutes |
| API read p95 | &lt; 3s | Sentry performance transaction p95 &gt; 3s for 15m |
| Error rate | &lt; 1% | Sentry issue spike &gt; 10 events / 5m |
| Daily cron success | 100% | Vercel cron log + `cron_run` JSON without `ok: false` |
| Pool errors | 0 sustained | Supabase “too many connections” in logs |

## Vercel

- Enable deployment notifications and function error alerts.
- Pin API functions to the same region as Supabase (`dub1` for tRPC in `vercel.json`).
- Review `maxDuration` if `dashboard.metrics` timeouts persist after cache warm-up.

## Sentry (optional)

Set `SENTRY_DSN` and `SENTRY_TRACES_SAMPLE_RATE=0.1` in production. tRPC failures are captured via `server/_core/trpc.ts` error middleware.

## PostHog

- Client: production only (`VITE_ENV=production`).
- Server: `POSTHOG_API_KEY` for cron completion events (`cron_*_complete`).

## Runbook snippets

**Dashboard slow:** check Upstash cache hit, Supabase slow queries, reduce `METRICS_TIMEOUT` fallbacks in logs.  
**Cron duplicate notifications:** verify `notificationDedup` — adjust `withinHours` in `inventoryAlerts.ts`.  
**keep-alive 401:** ensure `CRON_SECRET` is set on Vercel (cron Bearer is automatic when secret exists).
