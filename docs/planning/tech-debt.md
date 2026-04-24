## Tech Debt

- Legacy analytics reports (`inventoryV2.reports.stockStatus`, `stockMovement`, `expiryForecast`, `vedAnalysis`, `warehouseUtilization`, `abcAnalysis`, `fnsAnalysis`, `forecastDemand`) still read from `inventory_stock`. Review and migrate in analytics reports workstream after Phase 7.

## inventory_stock retirement (deferred from Phase 7f)

- Status: DEFERRED - table still exists, still written by 5 operational paths.
- Reason for deferral: pre-drop audit found more coupled paths than anticipated; migration requires a dedicated sprint with full regression coverage for transfers, counts, expiry, and import flows.

### QUANTITY_WRITE paths remaining (must migrate before DROP)

1. Transfer dispatch (`server/routers/inventoryRouter.ts` around `1826-1833`)
2. Transfer receive (`server/routers/inventoryRouter.ts` around `1874-1881`)
3. Admin historical import quantity write (`server/routers/inventoryRouter.ts` around `3538-3546`)
4. Historical movement confirmer (`server/routers/inventoryRouter.ts` around `3623-3625`)
5. Expiry auto-write (`server/_core/inventoryAlerts.ts` around `160-167`)

### QUANTITY_READ paths remaining (must migrate before DROP)

1. Item stock fetch by warehouse/item (`server/routers/inventoryRouter.ts` around `544-557`) - reads quantity and threshold values.
2. Warehouse + catalogue stock pull for merge/reconciliation (`server/routers/inventoryRouter.ts` around `735, 738, 739`) - fallback read before ledger merge.
3. Stock overview + by-item list (`server/routers/inventoryRouter.ts` around `806-860`) - reads quantities, then partially overlays ledger totals.
4. Suggested source warehouse stock check (`server/routers/inventoryRouter.ts` around `2301-2302`) - quantity sufficiency read.
5. Full inventory export (`server/routers/inventoryRouter.ts` around `3428`) - includes full `inventory_stock` snapshot.
6. Count session bootstrap (`server/routers/inventoryRouter.ts` around `3672-3674`) - seeds expected quantities from `inventory_stock`.
7. Count approve lookup (`server/routers/inventoryRouter.ts` around `3742`) - compares expected vs actual against `inventory_stock.quantity_on_hand`.
8. Count + expiry reporting joins (`server/routers/inventoryRouter.ts` around `3820-3856`) - joins count lines and batches through `inventory_stock`.
9. Expiry procedures + weekly threshold scan (`server/routers/inventoryRouter.ts` around `3885, 3924`; `server/_core/inventoryAlerts.ts` around `201`) - reads stock quantities and threshold inputs.

### SETTINGS_CRUD migration note

- `getOrCreateStock` bootstrap and zone/threshold settings currently rely on `inventory_stock`.
- Before drop, move settings reads/writes to a dedicated `stock_settings` table.

### Recommended approach

1. Create `stock_settings` table with config fields only:
   - `catalogue_id`
   - `warehouse_id`
   - `min_level`
   - `max_level`
   - `safety_stock_level`
   - `zone_location`
   - no quantity columns
2. Migrate settings CRUD from `inventory_stock` to `stock_settings`.
3. Migrate quantity reads to `stock_movements` aggregate queries (or existing stock card/materialized helper where needed).
4. Remove all 5 remaining quantity write paths to `inventory_stock`.
5. Validate with focused tests for transfer, count, expiry, and import paths.
6. Drop `inventory_stock` only after reads/writes reach zero.

- Estimated effort: 4-6 hours focused sprint.
- Priority: after go-live, before first donor audit.

