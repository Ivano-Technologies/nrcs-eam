-- List-path indexes for inventory documents, waybills, and requisitions.

CREATE INDEX IF NOT EXISTS idx_inventory_documents_grn_list
  ON inventory_documents (document_type, to_warehouse_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_waybills_list
  ON waybills (warehouse_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requisitions_facility_status
  ON requisitions (requesting_facility, status, created_at DESC);
