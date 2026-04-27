ALTER TYPE "public"."facility_type" ADD VALUE IF NOT EXISTS 'national_headquarters';

ALTER TABLE "sites"
  ALTER COLUMN "code" TYPE varchar(15);

ALTER TABLE "sites" DROP CONSTRAINT IF EXISTS "sites_code_wms_format_chk";

ALTER TABLE "sites"
  ADD CONSTRAINT "sites_code_wms_format_chk"
  CHECK ("code" IS NULL OR "code" ~ '^[A-Z0-9-]{2,15}$');
