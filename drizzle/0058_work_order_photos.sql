-- Work-order field photos (mobile capture).
-- Mirrors 0045_facility_photos.sql: table + index only.
-- RLS posture matches facility_photos (0025 enabled RLS for tables that
-- existed then; app access is enforced in tRPC via assertRecordFacilityAccess).

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
