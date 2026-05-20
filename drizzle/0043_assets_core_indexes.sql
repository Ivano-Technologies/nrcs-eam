-- Add missing indexes on core assets columns used in filters and joins.
-- These were not covered by migration 0042 which focused on FK columns
-- in newer tables.

CREATE INDEX IF NOT EXISTS idx_assets_site_id 
  ON assets("siteId");

CREATE INDEX IF NOT EXISTS idx_assets_category_id 
  ON assets("categoryId");

CREATE INDEX IF NOT EXISTS idx_assets_register_status 
  ON assets("registerStatus");

CREATE INDEX IF NOT EXISTS idx_assets_status 
  ON assets("status");
