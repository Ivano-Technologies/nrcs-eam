-- Migration: 0044_assets_core_indexes
-- Add missing indexes on core assets columns used in filters and joins.
-- Complements 0043_performance_indexes (registerStatus not covered there).

CREATE INDEX IF NOT EXISTS idx_assets_site_id 
  ON assets("siteId");

CREATE INDEX IF NOT EXISTS idx_assets_category_id 
  ON assets("categoryId");

CREATE INDEX IF NOT EXISTS idx_assets_register_status 
  ON assets("registerStatus");

CREATE INDEX IF NOT EXISTS idx_assets_status 
  ON assets("status");
