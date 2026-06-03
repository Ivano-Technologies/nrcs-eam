-- TEMPLATE ONLY — run pg_stat_user_indexes.sql on production first.
-- Replace each DROP with indexes confirmed idx_scan = 0 for 30+ days.

-- DROP INDEX CONCURRENTLY IF EXISTS idx_document_print_log_printed_by;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_import_drafts_uploaded_by;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_pending_users_approved_by;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_requisitions_authorized_by;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_requisitions_rejected_by;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_waybill_line_ctn_sources_override_by;
