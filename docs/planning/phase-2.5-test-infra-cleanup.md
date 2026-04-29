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

## Step 1 inventory (2026-04-29)

Searched all Playwright coverage for `mvp-audit` and `live-auth` for `seedE2E`, `runSeedE2E`, and `seed-e2e:local`.

### Seed call sites and hook classification

- `tests/mvp-audit/auth.setup.ts`
  - Call: `runSeedE2E()`
  - Classification: setup/global bootstrap file (not `beforeEach`, `beforeAll`, or test body)
- `tests/mvp-audit/helpers/e2eAuth.ts`
  - Call: `execSync("pnpm run seed-e2e:local", ...)` inside `runSeedE2E()`
  - Classification: shared setup utility (not `beforeEach`, `beforeAll`, or test body)

### Spec-level hook usage summary

- `beforeEach`: none
- `beforeAll`: none
- `test body`: none

### Script definition reference

- `package.json`
  - Script: `"seed-e2e:local": "dotenv -e .env.e2e -- tsx scripts/db/seed-e2e.ts"`

## Step 4 run outcomes (2026-04-29)

Executed required loop runs and captured repeatability:

- `pnpm exec playwright test --project=mvp-audit`
  - Repeated 3x in sequence (fast-loop mode with `--max-failures=1` for deterministic signal capture).
  - All 3 runs failed consistently at the same early failure:
    - `tests/mvp-audit/specs/assets.spec.ts` (`full asset lifecycle`) timing out on edit form interaction.
- `pnpm exec playwright test --project=live-auth`
  - Repeated 3x in sequence (fast-loop mode with `--max-failures=1`).
  - All 3 runs failed; unstable failure target shifted between:
    - `tests/features/improvements.spec.ts` (sidebar collapsed tooltip expectation), and
    - `tests/auth/users-management.spec.ts` (edit-user Save button stays disabled / timeout).
- Targeted verification runs used for known-failure pruning:
  - `tests/mvp-audit/specs/inventory-deeplinks.spec.ts` passed 3/3 isolated runs.
  - `tests/mvp-audit/specs/wms-grn-create.spec.ts` failed in isolated validation.
  - `tests/features/inventory-counts.spec.ts` passed 3/3 isolated runs.
  - `tests/features/inventory-movements.spec.ts` failed in isolated validation.

`pnpm check:full` was run once before final pruning pass and failed because the working tree was not clean at that point; rerun after final commit is required.

## Step 6 separation assessment (2026-04-29)

No direct evidence of cross-project state contamination between `mvp-audit` and `live-auth` was observed in this run set.

- Observed failures are project-local UI/test-flow issues and environment-dependent endpoints.
- Recommendation: do not split Supabase projects yet; prioritize fixing remaining deterministic/known flaky specs first.
