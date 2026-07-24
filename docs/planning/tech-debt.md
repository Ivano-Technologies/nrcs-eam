## Tech Debt

## Self-contained database bootstrap (TASK-6) — CLOSED

- Status: CLOSED.
- Problem: CI and fresh local Postgres depended on an inline `psql` heredoc in `.github/workflows/ci.yml` (`CREATE OR REPLACE` stubs + apt `postgresql-client`). That was not reusable for local `db:setup` and was unsafe if copied against production.
- Resolution: `scripts/db/bootstrap.sql` + `pnpm db:bootstrap` / `pnpm db:setup`. Functions are existence-guarded only (never `CREATE OR REPLACE`). CI double-bootstraps and diffs md5 of `pg_get_functiondef` for the four managed functions. Supabase-only export notes live under `scripts/db/supabase-only/`.

## inventory_stock retirement

- Status: COMPLETE.
- Completed work:
  - `stock_settings` created and backfilled from legacy `inventory_stock` configuration fields.
  - All server quantity reads/writes migrated to `stock_movements` aggregates.
  - Bootstrap/settings flows migrated off `inventory_stock`.
  - `inventory_stock` table dropped from dev and e2e databases.
  - Schema and code references removed from runtime paths.

