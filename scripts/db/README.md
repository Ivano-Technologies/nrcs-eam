# Database utility scripts

Maintenance scripts for local or controlled environments. **Run from the repository root** (or any directory—the scripts resolve `.env` from the repo root).

**pnpm shortcuts** (from repo root):

| Command | Script |
|---------|--------|
| `pnpm db:bootstrap` | `apply-bootstrap.ts` |
| `pnpm db:setup` | bootstrap → migrate → seed |
| `pnpm db:reset` | `reset-db.mjs` |
| `pnpm db:seed` | `seed-db.mjs` |
| `pnpm db:seed:sample` | `seed-sample-data.mjs` |
| `pnpm db:cleanup` | `cleanup-database.mjs` |
| `pnpm db:clean-test-data` | `clean-test-data.ts` |
| `pnpm db:full-reset` | `full-reset.ts` |

| Script | Purpose |
|--------|---------|
| `bootstrap.sql` / `apply-bootstrap.ts` | Idempotent vanilla-Postgres prerequisites (roles, pgcrypto, guarded function stubs) |
| `hash-bootstrap-functions.ts` | md5 of bootstrap-managed function defs (CI idempotency check) |
| `supabase-only/` | Export notes + placeholder for real Supabase function bodies |
| `reset-db.mjs` | Truncate application tables (keeps users); PostgreSQL via `DATABASE_URL` |
| `seed-db.mjs` | Seed minimal sites and asset categories |
| `seed-sample-data.mjs` | Larger sample dataset |
| `cleanup-database.mjs` | Legacy SQLite cleanup (`.data/sqlite.db` under repo root) |
| `clear-data.sql` | Reference SQL for manual clears (PostgreSQL) |
| `full-reset.ts` | Full operational wipe; keeps admin user |
| `clean-test-data.ts` | Remove E2E/test rows; keeps NRCS sites |

Prerequisites: `DATABASE_URL` in `.env`. Use with care in production.

Tier 2B-retired tables (`vendors`, `financialTransactions`, `complianceRecords`, etc.) are skipped automatically after migration `0056`.
