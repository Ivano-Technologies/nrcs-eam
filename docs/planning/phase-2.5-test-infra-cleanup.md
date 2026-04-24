# Phase 2.5 — Test infrastructure stabilization

## Goal

Stabilize the Playwright test infrastructure across `mvp-audit` and `live-auth` without blocking current product delivery, then remove temporary flaky suppressions from `check:full`.

## Current status (after Phase 7)

- Playwright stabilization is still a deferred, dedicated workstream.
- WMS document flows were validated manually during Phase 7 and are considered operationally correct.
- Deferred failures remain managed via `scripts/check/known-failures.json`.
- This workstream is scheduled post-Phase 7 and should not block go-live.

## Scope

- Audit all `mvp-audit` and `live-auth` specs for per-test `seedE2E` calls.
- Move seed/auth bootstrap logic to one-time project setup instead of per-test hooks.
- Update `seed-e2e` to be idempotent and resilient to transient Supabase failures with stronger retry and exponential backoff.
- Remove temporary known-failure entries once stability is verified:
  - `mvp-audit/inventory-deeplinks.spec.ts`
  - `mvp-audit/wms-grn-create.spec.ts`
  - any `live-auth` entries proven flaky rather than genuinely pre-existing.
- Evaluate separating `mvp-audit` and `live-auth` into dedicated Supabase test projects to reduce shared-state and network coupling.

## Deliverables

- `check:full` green with zero unexpected failures under repeated runs.
- No per-test reseeding in `mvp-audit` and `live-auth` specs.
- Reduced setup-time network sensitivity in auth/seed bootstrap.
- Updated known-failures list with temporary flaky items removed.

## Suggested execution steps

1. Inventory all specs and setup hooks invoking `seedE2E` / `seed-e2e:local`.
2. Consolidate setup to project-level bootstrap (`auth.setup.ts`-style) and remove duplicate reseed calls from spec files.
3. Harden seed and Supabase auth helper retries with bounded exponential backoff and clear retry logging.
4. Run isolation loops and full-suite loops to confirm deterministic outcomes.
5. Prune known-failures entries that are no longer needed.

## Estimated effort

2-4 hours of focused work.

## Priority

Deferred post-Phase 7. This remains non-blocking for current delivery but should be scheduled before broad donor-facing regression automation requirements.
