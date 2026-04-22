ALTER TABLE "waybills"
  ADD COLUMN IF NOT EXISTS "destination_type" varchar(50) DEFAULT 'other' NOT NULL;

ALTER TABLE "waybills"
  ADD COLUMN IF NOT EXISTS "destination_location" text;

ALTER TABLE "waybill_lines"
  ADD COLUMN IF NOT EXISTS "item_id" integer;

UPDATE "waybill_lines" wl
SET "item_id" = ctn."item_id"
FROM "commodity_tracking_numbers" ctn
WHERE wl."ctn_id" = ctn."id" AND wl."item_id" IS NULL;

ALTER TABLE "waybill_lines"
  ALTER COLUMN "item_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'waybill_lines_item_id_inventory_catalogue_id_fk'
  ) THEN
    ALTER TABLE "waybill_lines"
      ADD CONSTRAINT "waybill_lines_item_id_inventory_catalogue_id_fk"
      FOREIGN KEY ("item_id") REFERENCES "inventory_catalogue"("id");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "waybill_line_ctn_sources" (
  "id" serial PRIMARY KEY NOT NULL,
  "waybill_line_id" integer NOT NULL,
  "ctn_id" integer NOT NULL,
  "quantity" double precision NOT NULL,
  "override_by_user_id" integer,
  "override_at" timestamp,
  "override_reason" text,
  "source_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'waybill_line_ctn_sources_waybill_line_id_waybill_lines_id_fk'
  ) THEN
    ALTER TABLE "waybill_line_ctn_sources"
      ADD CONSTRAINT "waybill_line_ctn_sources_waybill_line_id_waybill_lines_id_fk"
      FOREIGN KEY ("waybill_line_id") REFERENCES "waybill_lines"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'waybill_line_ctn_sources_ctn_id_commodity_tracking_numbers_id_fk'
  ) THEN
    ALTER TABLE "waybill_line_ctn_sources"
      ADD CONSTRAINT "waybill_line_ctn_sources_ctn_id_commodity_tracking_numbers_id_fk"
      FOREIGN KEY ("ctn_id") REFERENCES "commodity_tracking_numbers"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'waybill_line_ctn_sources_override_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "waybill_line_ctn_sources"
      ADD CONSTRAINT "waybill_line_ctn_sources_override_by_user_id_users_id_fk"
      FOREIGN KEY ("override_by_user_id") REFERENCES "users"("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "waybill_line_ctn_sources_line_idx" ON "waybill_line_ctn_sources" ("waybill_line_id");
CREATE INDEX IF NOT EXISTS "waybill_line_ctn_sources_ctn_idx" ON "waybill_line_ctn_sources" ("ctn_id");
