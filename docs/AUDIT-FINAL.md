# Phase 7 — Final Assessment (NRCS EAM)

Synthesis from Phases 1–5 only. No new file audit.

---

## 1. Executive Summary

NRCS EAM is a **production-deployed** monolith (Vercel + Supabase Postgres + tRPC) with a large WMS/EAM surface area. The audit pass across five phases identified **critical auth and deploy gaps** (unauthenticated document export, stale PWA/tRPC caching, missing cron secrets) and **scale risks** (unbounded list queries, missing asset indexes, ~8 MB PWA precache including dev-only chunks).

**Six commits on `main`** (`cb1c2d1` → `c13aba7`) addressed the highest-impact items: dependency/deploy stability, DB indexes and query caps, API auth and cron hardening, production bundle/PWA diet, and operational gates (CI typecheck, deep health, PostHog error capture).

**Remaining systemic risk** is **authorization depth**: app-layer auth works for many routes, but **facility/tenant scoping is incomplete** (deferred P3-B), and the server uses a **service-role database connection**, so Postgres RLS is not the safety net. **Testing** still relies heavily on **live production smoke**; CI now blocks TypeScript regressions but not behavioral ones.

**Verdict:** Suitable for continued production use with the fixes shipped; **not yet “enterprise-hardened”** until scoping, CI test DB, and dependency/CVE hygiene are addressed. Overall readiness: **~6.5/10** — strong feature delivery and recent hardening; governance and multi-tenant safety still maturing.

---

## 2. Top 10 Risks (severity × likelihood)

| Rank | Risk | Severity | Likelihood | Notes |
|------|------|----------|------------|-------|
| 1 | **Incomplete facility / site scoping (P3-B)** | Critical | High | Service-role DB bypasses RLS; cross-facility data exposure if queries omit filters |
| 2 | **Monolithic routers (~8k+ lines)** | High | High | Regressions hard to spot; auth checks inconsistent across procedures |
| 3 | **No automated test gate in CI** | High | High | Only `pnpm check`; Vitest/Playwright need DB — regressions can reach `main` |
| 4 | **Live E2E against production** | High | Medium | Mutating tests (users-management) + skipped write suites = false confidence |
| 5 | **50 Dependabot vulnerabilities (28 high)** | High | Medium | Monthly audit exists but not blocking merges |
| 6 | **Dashboard / KPI scope not role-bound (P3-H, P4-C)** | Medium | High | Managers/staff may see org-wide metrics inconsistent with row-level intent |
| 7 | **Dual patterns (compliance, inventory, maintenance cost)** | Medium | Medium | Schema/logic drift, reporting inconsistencies |
| 8 | **Destructive ops (e.g. deleteSite) without full cascade policy** | Medium | Medium | Deferred P2; orphan or partial deletes |
| 9 | **Shallow health on Express paths** | Low | Medium | Deep check only on Vercel `api/health.ts`; local/`apiApp` still liveness-only |
| 10 | **PWA + offline sync complexity** | Medium | Low | NetworkOnly for `/api/*` fixed; offline queue edge cases less tested in CI |

---

## 3. Top 10 Quick Wins (not yet implemented)

| # | Win | Effort | Phase ref |
|---|-----|--------|-----------|
| 1 | Mirror `?deep=1` on `apiApp` `/health` and `/api/health` | Hours | P5-C gap |
| 2 | Point uptime monitor at `https://nrcseam.techivano.com/health?deep=1` | Hours | P5-C |
| 3 | Add Vitest job to CI once test DB URL secret exists (no seed on PR) | 1–2 days | P5-A |
| 4 | Split `pnpm test` → `test:unit` vs `test:integration` | Hours | P5-E |
| 5 | Triage `known-failures.json` — remove or fix one spec per sprint | Hours | P5-G |
| 6 | Enable PostHog server `enableExceptionAutocapture` if SDK supports it | Hours | P5-D |
| 7 | Document `CRON_SECRET`, `POSTHOG_*`, E2E creds in `.env.example` | Hours | P3-E, P5 |
| 8 | Smoke-test Vercel crons after `CRON_SECRET` deploy (401 vs 200) | Hours | P3-E |
| 9 | Restrict live-auth to **read-only** specs; keep writes in `mvp-audit` only | 1 day | P5-B (partial) |
| 10 | Add PR checklist: run `check:full` or `CHECK_FULL_SKIP_*` documented | Hours | P5-A |

---

## 4. What Is Already Strong

**Deploy & client (Phase 1 + 4)**

- tRPC **11.17.0** aligned; **frozen lockfile** on Vercel
- PWA: **NetworkOnly** for `/api/*`; removed stale tRPC cache behavior
- Production bundle: **mermaid/showcase excluded** (~700 kB raw); precache **~1.15 MB smaller** (157 entries)
- Document export: **API base URL + `credentials: include`**
- Removed **manus-runtime-user-info** localStorage writes

**Database (Phase 2)**

- Migration **0043** asset indexes (applied in prod)
- **List caps** on major `getAll*` paths; **register/export max 5k**
- `ASSET_REGISTER_MAX_LIMIT` centralized

**API / security (Phase 3)**

- **Document export** authenticated with role checks
- **Cron routes** require `CRON_SECRET` bearer
- **Notifications** scoped to `userId` on read/delete
- **scheduledReports** manager/admin only
- **registerList** Zod max tied to DB constant

**Operations (Phase 5)**

- **GitHub Actions CI** — `pnpm check` on push/PR to `main`
- **Deep health** `?deep=1` with DB probe (503 on failure)
- **PostHog** in ErrorBoundary, client `unhandledrejection`, server `unhandledRejection`
- **Two-tier E2E** design (local `mvp-audit` + live smoke)
- **`check:full`** local orchestration (tsc, migrations, vitest, playwright w/ known failures)
- **Monthly `pnpm audit`** workflow with critical fail

**Product / engineering culture**

- Extensive **data-testid** coverage for E2E
- **Global E2E teardown** that preserves GRN opening balances (waybill-only delete)
- **PostHog** session replay with masked inputs in production

---

## 5. Optimization Roadmap

### Immediate (1–3 days)

- Verify **CI workflow** green on `main` after `c13aba7`
- Configure monitor on **`/health?deep=1`**
- **Cron smoke** on Vercel (daily/weekly/monthly with `CRON_SECRET`)
- Align **Express health** with deep probe (quick win #1)
- Review **live-auth** mutating test (`users-management`) — run only on demand

### Short-term (1–2 weeks)

- **CI test database**: Supabase branch or Docker Postgres + `pnpm test` on PR
- Start **P3-B** facility scoping on highest-risk routers (assets, inventory, users)
- **Dependabot**: batch high CVEs from monthly report
- Re-enable **mvp-audit** skipped write paths (assets, work orders, signup) locally
- **Route guards** (P4-B) aligned with scoped procedures

### Medium-term (1–2 months)

- **Router decomposition** — extract WMS, finance, compliance into mounted sub-routers
- **Staging environment** (Vercel preview + dedicated DB) — deferred P5-B
- **Role-scoped dashboard** KPIs (P3-H / P4-C)
- **Schema consolidation** — single compliance/inventory truth paths
- **Playwright in CI** with ephemeral schema + `CHECK_FULL_SKIP_PLAYWRIGHT=0`

### Long-term

- **Multi-tenant hardening**: RLS policies + restricted DB role for read paths where feasible
- **SLOs**: error budget from PostHog, p95 tRPC latency, cron success metrics
- **Soft delete / audit** standard for destructive domain ops
- **Architecture docs** + ADRs for auth model and facility model

---

## 6. Production Readiness Scores (1–10)

| Category | Score | Rationale |
|----------|-------|-----------|
| **Database layer** | **7** | Indexes and caps shipped; migrations disciplined; scoping and dual-schema patterns still weak |
| **Backend / API layer** | **6** | Critical export/cron/notification fixes done; monolithic routers and incomplete facility filters hold score down |
| **Frontend / UI** | **7** | Prod bundle trimmed, export auth fixed, PWA sane; route/role UI guards and dashboard scope incomplete |
| **Security** | **6** | Auth on sensitive endpoints improved; service-role DB + scoping gap + 28 high CVEs limit score |
| **Reliability & operations** | **7** | CI typecheck, deep health, PostHog errors, crons secured; no full CI tests, prod E2E reliance |
| **Overall** | **6.5** | Production-viable with recent hardening; enterprise readiness needs scoping, CI tests, CVEs, staging |

---

## Audit commit trail on `main`

| Commit | What |
|--------|------|
| `cb1c2d1` | tRPC upgrade, frozen lockfile, PWA NetworkOnly |
| `bb322dc` | Asset indexes, list caps, export limit |
| `e775ece` | Document auth, cron secret, notification scoping, roles |
| `f785f4b` | Bundle trim, mermaid removed, PWA precache diet |
| `c13aba7` | CI workflow, deep health, PostHog error capture |

---

## Deferred items (carry forward)

| ID | Item | Phase |
|----|------|-------|
| P3-B | Facility / site scoping across routers | 3 |
| P3-H | Dashboard KPI scope by role | 3 |
| P3-D | PublicUser shape cleanup | 3 |
| — | Router split / decomposition | 1, 3 |
| P4-B | Route-level guards (with scoping) | 4 |
| P4-C / P4-E | Role/dashboard scope in UI | 4 |
| P4-F | Route config refactor | 4 |
| P2 (various) | deleteSite, db.ts split, soft delete, schema constraints batch | 2 |
| P5-B | Staging environment (Vercel + separate DB) | 5 |
| P5-E | Split `test` vs `test:integration` | 5 |
| P5-F | Playwright parallelism | 5 |
| P5-G | Known-failures hygiene | 5 |
| P5-I | Vitest vs shared dev DB | 5 |
| P5-H | Dependabot CVEs (tracked via monthly workflow) | 5 |
