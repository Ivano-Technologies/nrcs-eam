-- Relax facility code length from 2-5 to 2-8 uppercase alphanumeric.
-- Hyphens remain disallowed to keep hierarchy modeled via foreign keys.
ALTER TABLE "sites" DROP CONSTRAINT IF EXISTS "sites_code_wms_format_chk";

ALTER TABLE "sites"
  ADD CONSTRAINT "sites_code_wms_format_chk"
  CHECK ("code" IS NULL OR "code" ~ '^[A-Z0-9]{2,8}$');
