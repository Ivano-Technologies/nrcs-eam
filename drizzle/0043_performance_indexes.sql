-- Migration: 0043_performance_indexes
-- Query-path indexes for facility filters, dashboard COUNTs, and finance date ranges.
-- All statements use CREATE INDEX IF NOT EXISTS to be safe to re-run.
-- Note: idx_users_site_id may already exist from 0042_unindexed_fk_indexes.

-- assets: siteId used in facility-scoped queries everywhere
CREATE INDEX IF NOT EXISTS idx_assets_site_id ON assets("siteId");

-- assets: status used in dashboard COUNTs
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets("status");

-- assets: categoryId used in filters
CREATE INDEX IF NOT EXISTS idx_assets_category_id ON assets("categoryId");

-- users: siteId used in facility filter + JOIN
CREATE INDEX IF NOT EXISTS idx_users_site_id ON users("siteId");

-- users: role used in admin filter
CREATE INDEX IF NOT EXISTS idx_users_role ON users("role");

-- financialTransactions: transactionDate used in date range filters
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON "financialTransactions"("transactionDate");

-- financialTransactions: assetId used in joins
CREATE INDEX IF NOT EXISTS idx_financial_transactions_asset_id ON "financialTransactions"("assetId");

-- sites: isActive used in every sites.list query
CREATE INDEX IF NOT EXISTS idx_sites_is_active ON sites("isActive");

-- sites: facilityType used in branch/division filters
CREATE INDEX IF NOT EXISTS idx_sites_facility_type ON sites("facilityType");
