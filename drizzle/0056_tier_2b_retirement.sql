-- Tier 2B: Finance, vendors, and orphan QuickBooks retirement (direct drop, no archives).

DELETE FROM "scheduledReports" WHERE "reportType"::text IN ('financial', 'compliance');

ALTER TABLE "inventoryItems" DROP COLUMN IF EXISTS "vendorId";

DROP TABLE IF EXISTS "financialTransactions" CASCADE;
DROP TABLE IF EXISTS maintenance_costs CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS "quickbooksConfig" CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS "complianceRecords" CASCADE;

DROP TYPE IF EXISTS financial_tx_type;
DROP TYPE IF EXISTS compliance_status;

ALTER TYPE scheduled_report_type RENAME TO scheduled_report_type_old;
CREATE TYPE scheduled_report_type AS ENUM ('assetInventory', 'maintenanceSchedule', 'workOrders');
ALTER TABLE "scheduledReports"
  ALTER COLUMN "reportType" TYPE scheduled_report_type
  USING "reportType"::text::scheduled_report_type;
DROP TYPE scheduled_report_type_old;
