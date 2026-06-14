-- Dashboard stock query indexes for movement filters and location lookups.

CREATE INDEX IF NOT EXISTS idx_stock_movements_source_date ON stock_movements (source_type, date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_document_ref ON stock_movements (document_ref);
CREATE INDEX IF NOT EXISTS idx_stock_cards_location_id ON stock_cards (location_id);
