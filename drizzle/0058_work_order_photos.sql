-- Work-order field photos (mobile capture).
-- Mirrors 0045_facility_photos.sql: table + index, plus RLS (IVA-175).
-- RLS matches 0025 and prod facility_photos: enabled, with only the
-- service_role_full_access policy, so the public API keys cannot read or write
-- the table. App access is enforced in tRPC via assertRecordFacilityAccess.

CREATE TABLE IF NOT EXISTS work_order_photos (
  id SERIAL PRIMARY KEY,
  "workOrderId" INTEGER NOT NULL REFERENCES "workOrders"(id) ON DELETE CASCADE,
  "storageKey" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "caption" TEXT,
  "uploadedByUserId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_order_photos_work_order_id
  ON work_order_photos("workOrderId");

ALTER TABLE "work_order_photos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "work_order_photos";
CREATE POLICY "service_role_full_access" ON "work_order_photos"
  TO service_role
  USING (true)
  WITH CHECK (true);
