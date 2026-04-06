-- Clear all sample data (preserving user accounts)
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM asset_transfers;
DELETE FROM asset_lifecycle_costs;
DELETE FROM predictive_maintenance;
DELETE FROM notifications;
DELETE FROM notification_preferences;
DELETE FROM compliance_reports;
DELETE FROM financial_transactions;
DELETE FROM quickbooks_config;
DELETE FROM report_schedules;
DELETE FROM work_order_photos;
DELETE FROM work_orders;
DELETE FROM maintenance_schedules;
DELETE FROM inventory_items;
DELETE FROM vendors;
DELETE FROM assets;
DELETE FROM asset_categories;
DELETE FROM sites;

SET FOREIGN_KEY_CHECKS = 1;
