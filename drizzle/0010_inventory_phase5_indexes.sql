CREATE INDEX IF NOT EXISTS "inv_stock_warehouse_item_idx"
  ON "inventory_stock" ("catalogue_id", "warehouse_id");

CREATE INDEX IF NOT EXISTS "inv_mov_catalogue_created_idx"
  ON "inventory_movements" ("catalogue_id", "created_at");

CREATE INDEX IF NOT EXISTS "inv_mov_warehouse_created_idx"
  ON "inventory_movements" ("from_warehouse_id", "created_at");

CREATE INDEX IF NOT EXISTS "inv_batch_active_expiry_idx"
  ON "inventory_batches" ("expiry_date");

CREATE INDEX IF NOT EXISTS "req_status_priority_idx"
  ON "requisitions" ("status", "priority");
