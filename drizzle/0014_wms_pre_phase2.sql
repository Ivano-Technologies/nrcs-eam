-- Pre–Phase 2: extend WMS stock movement source enum and facility codes.
-- Safe to re-run on PostgreSQL 15+ (IF NOT EXISTS on enum values).

-- Clear invalid facility codes so the CHECK below can be added on legacy/test rows.
UPDATE "sites" SET "code" = NULL WHERE "code" IS NOT NULL AND "code" !~ '^[A-Z0-9]{2,5}$';

ALTER TYPE "public"."wms_stock_movement_source" ADD VALUE IF NOT EXISTS 'transfer_in';
ALTER TYPE "public"."wms_stock_movement_source" ADD VALUE IF NOT EXISTS 'transfer_out';
ALTER TYPE "public"."wms_stock_movement_source" ADD VALUE IF NOT EXISTS 'kit_assembly';
ALTER TYPE "public"."wms_stock_movement_source" ADD VALUE IF NOT EXISTS 'kit_disassembly';
ALTER TYPE "public"."wms_stock_movement_source" ADD VALUE IF NOT EXISTS 'expiry';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sites_code_wms_format_chk'
  ) THEN
    ALTER TABLE "sites"
      ADD CONSTRAINT "sites_code_wms_format_chk"
      CHECK ("code" IS NULL OR "code" ~ '^[A-Z0-9]{2,5}$');
  END IF;
END $$;

-- Canonical facility codes for seed facility names (see scripts/db/seed-facilities.ts).
-- Clear stale NHQ/LAG/KAN assignments so unique `sites.code` is not violated by other rows.
UPDATE "sites" SET "code" = NULL WHERE "code" IN ('NHQ', 'LAG', 'KAN');

-- Apply each seed code to one canonical row only (lowest id for matching name),
-- and force all other same-name rows to NULL to preserve unique(code).
WITH ranked AS (
  SELECT id, name, row_number() OVER (PARTITION BY name ORDER BY id) AS rn
  FROM "sites"
  WHERE name IN ('NRCS Headquarters - Abuja', 'NRCS Lagos Branch', 'NRCS Kano Branch')
)
UPDATE "sites" s
SET "code" = CASE
  WHEN r.name = 'NRCS Headquarters - Abuja' AND r.rn = 1 THEN 'NHQ'
  WHEN r.name = 'NRCS Lagos Branch' AND r.rn = 1 THEN 'LAG'
  WHEN r.name = 'NRCS Kano Branch' AND r.rn = 1 THEN 'KAN'
  ELSE NULL
END
FROM ranked r
WHERE s.id = r.id;
