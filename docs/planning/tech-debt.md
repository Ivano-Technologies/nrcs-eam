## Tech Debt

## inventory_stock retirement

- Status: COMPLETE.
- Completed work:
  - `stock_settings` created and backfilled from legacy `inventory_stock` configuration fields.
  - All server quantity reads/writes migrated to `stock_movements` aggregates.
  - Bootstrap/settings flows migrated off `inventory_stock`.
  - `inventory_stock` table dropped from dev and e2e databases.
  - Schema and code references removed from runtime paths.

