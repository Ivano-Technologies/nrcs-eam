-- Reference SQL: clear operational sample data (PostgreSQL).
-- Preserves users and __drizzle_migrations. Run manually with care.
-- Tier 2B-retired tables (vendors, financialTransactions, complianceRecords,
-- budgets, maintenance_costs, and retired accounting-config table) omitted — dropped in migration 0056.

BEGIN;

DELETE FROM "assetTransfers";
DELETE FROM "inventoryTransactions";
DELETE FROM notifications;
DELETE FROM "notificationPreferences";
DELETE FROM "auditLogs";
DELETE FROM documents;
DELETE FROM "assetPhotos";
DELETE FROM "scheduledReports";
DELETE FROM email_notifications;
DELETE FROM "workOrderTemplates";
DELETE FROM "workOrders";
DELETE FROM "maintenanceSchedules";
DELETE FROM "inventoryItems";
DELETE FROM assets;
DELETE FROM "assetCategories";
DELETE FROM sites;

COMMIT;
