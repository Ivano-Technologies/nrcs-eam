ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "app_settings";
CREATE POLICY "service_role_full_access" ON "app_settings"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "assetCategories" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "assetCategories";
CREATE POLICY "service_role_full_access" ON "assetCategories"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "assetPhotos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "assetPhotos";
CREATE POLICY "service_role_full_access" ON "assetPhotos"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "assetTransfers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "assetTransfers";
CREATE POLICY "service_role_full_access" ON "assetTransfers"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "auditLogs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "auditLogs";
CREATE POLICY "service_role_full_access" ON "auditLogs"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "complianceRecords" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "complianceRecords";
CREATE POLICY "service_role_full_access" ON "complianceRecords"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "documents";
CREATE POLICY "service_role_full_access" ON "documents"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "email_notifications" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "email_notifications";
CREATE POLICY "service_role_full_access" ON "email_notifications"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "email_templates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "email_templates";
CREATE POLICY "service_role_full_access" ON "email_templates"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "financialTransactions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "financialTransactions";
CREATE POLICY "service_role_full_access" ON "financialTransactions"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "inventoryItems" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "inventoryItems";
CREATE POLICY "service_role_full_access" ON "inventoryItems"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "inventoryTransactions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "inventoryTransactions";
CREATE POLICY "service_role_full_access" ON "inventoryTransactions"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "maintenanceSchedules" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "maintenanceSchedules";
CREATE POLICY "service_role_full_access" ON "maintenanceSchedules"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "notificationPreferences" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "notificationPreferences";
CREATE POLICY "service_role_full_access" ON "notificationPreferences"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "notifications";
CREATE POLICY "service_role_full_access" ON "notifications"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "quickbooksConfig" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "quickbooksConfig";
CREATE POLICY "service_role_full_access" ON "quickbooksConfig"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "scheduledReports" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "scheduledReports";
CREATE POLICY "service_role_full_access" ON "scheduledReports"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "userPreferences" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "userPreferences";
CREATE POLICY "service_role_full_access" ON "userPreferences"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "sites" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "sites";
CREATE POLICY "service_role_full_access" ON "sites"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "vendors";
CREATE POLICY "service_role_full_access" ON "vendors"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "workOrderTemplates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "workOrderTemplates";
CREATE POLICY "service_role_full_access" ON "workOrderTemplates"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "workOrders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "workOrders";
CREATE POLICY "service_role_full_access" ON "workOrders"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "pending_users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "pending_users";
CREATE POLICY "service_role_full_access" ON "pending_users"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "users";
CREATE POLICY "service_role_full_access" ON "users"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "assets";
CREATE POLICY "service_role_full_access" ON "assets"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "inventory_documents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "inventory_documents";
CREATE POLICY "service_role_full_access" ON "inventory_documents"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "inventory_batches" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "inventory_batches";
CREATE POLICY "service_role_full_access" ON "inventory_batches"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "inventory_counts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "inventory_counts";
CREATE POLICY "service_role_full_access" ON "inventory_counts"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "distributions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "distributions";
CREATE POLICY "service_role_full_access" ON "distributions"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "inventory_kits" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "inventory_kits";
CREATE POLICY "service_role_full_access" ON "inventory_kits"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "kit_assemblies" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "kit_assemblies";
CREATE POLICY "service_role_full_access" ON "kit_assemblies"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "inventory_count_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "inventory_count_lines";
CREATE POLICY "service_role_full_access" ON "inventory_count_lines"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "inventory_catalogue" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "inventory_catalogue";
CREATE POLICY "service_role_full_access" ON "inventory_catalogue"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "goods_received_notes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "goods_received_notes";
CREATE POLICY "service_role_full_access" ON "goods_received_notes"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "donors" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "donors";
CREATE POLICY "service_role_full_access" ON "donors"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "commodity_tracking_numbers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "commodity_tracking_numbers";
CREATE POLICY "service_role_full_access" ON "commodity_tracking_numbers"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "goods_received_note_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "goods_received_note_lines";
CREATE POLICY "service_role_full_access" ON "goods_received_note_lines"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "facility_notification_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "facility_notification_settings";
CREATE POLICY "service_role_full_access" ON "facility_notification_settings"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "requisitions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "requisitions";
CREATE POLICY "service_role_full_access" ON "requisitions"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "stock_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "stock_settings";
CREATE POLICY "service_role_full_access" ON "stock_settings"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "waybill_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "waybill_lines";
CREATE POLICY "service_role_full_access" ON "waybill_lines"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "stock_cards" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "stock_cards";
CREATE POLICY "service_role_full_access" ON "stock_cards"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "waybills" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "waybills";
CREATE POLICY "service_role_full_access" ON "waybills"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "bin_cards" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "bin_cards";
CREATE POLICY "service_role_full_access" ON "bin_cards"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "stock_movements";
CREATE POLICY "service_role_full_access" ON "stock_movements"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "document_number_sequences" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "document_number_sequences";
CREATE POLICY "service_role_full_access" ON "document_number_sequences"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "kit_ctn_contributors" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "kit_ctn_contributors";
CREATE POLICY "service_role_full_access" ON "kit_ctn_contributors"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "document_print_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "document_print_log";
CREATE POLICY "service_role_full_access" ON "document_print_log"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "waybill_line_ctn_sources" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "waybill_line_ctn_sources";
CREATE POLICY "service_role_full_access" ON "waybill_line_ctn_sources"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "inventory_import_drafts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "inventory_import_drafts";
CREATE POLICY "service_role_full_access" ON "inventory_import_drafts"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "notifications_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "notifications_log";
CREATE POLICY "service_role_full_access" ON "notifications_log"
  TO service_role
  USING (true)
  WITH CHECK (true);
