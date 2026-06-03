-- Run in Supabase SQL Editor (production) before dropping any index.
-- Review idx_scan = 0 for 30+ days; do not DROP in automation.

SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- Candidate FK indexes from drizzle/0042 (verify idx_scan before DROP):
-- idx_document_print_log_printed_by
-- idx_inventory_import_drafts_uploaded_by
-- idx_pending_users_approved_by
-- idx_requisitions_authorized_by, idx_requisitions_rejected_by
-- idx_waybill_line_ctn_sources_override_by
