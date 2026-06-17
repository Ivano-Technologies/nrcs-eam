# Tier 2B: Finance & QuickBooks Retirement

**Status:** COMPLETED

## Deleted modules / routes

- Financial dashboard, cost analysis, asset valuation, vendor management
- QuickBooks integration, annual finance reports
- Legacy routes: `/app/financial/*`, `/app/finance/*`, `/app/cost-analytics`, `/app/compliance`, `/app/audit-trail`, `/app/vendors`, `/app/quickbooks`, `/app/reports/annual-finance`

## Deleted DB tables

- `vendors`
- `financialTransactions`
- `complianceRecords`
- `quickbooksConfig`
- `budgets`
- `maintenance_costs`

No archive tables — direct drop in migration `0056`.

## Schema changes

- Removed `vendorId` from `inventoryItems` (migration `0056`)
- Removed `financial_tx_type` and `compliance_status` enums
- `scheduled_report_type` reduced to `assetInventory`, `maintenanceSchedule`, `workOrders` (removed `financial`, `compliance`)

## Kept (governance focus)

- Compliance tracking (`complianceTracking`), insurance records, depreciation report, audit logs
- New routes:
  - `/app/administration/compliance-register`
  - `/app/reports/depreciation-schedule`
  - `/app/administration/activity-log`

## Rationale

- NRCS handles finance / QuickBooks externally (post-MVP decision)
- Compliance consolidated under Administration; depreciation under Reports
- Reduced schema surface area; no orphan `vendorId` on inventory items

## Migration

Apply before next production deploy:

```bash
pnpm drizzle:migrate
```

File: `drizzle/0056_tier_2b_retirement.sql`
