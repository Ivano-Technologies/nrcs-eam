CREATE TABLE IF NOT EXISTS "stock_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "catalogue_id" integer NOT NULL,
  "warehouse_id" integer NOT NULL,
  "min_level" double precision DEFAULT 0,
  "max_level" double precision,
  "safety_stock_level" double precision,
  "zone_location" varchar(100),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_settings_catalogue_id_inventory_catalogue_id_fk'
  ) THEN
    ALTER TABLE "stock_settings"
      ADD CONSTRAINT "stock_settings_catalogue_id_inventory_catalogue_id_fk"
      FOREIGN KEY ("catalogue_id") REFERENCES "public"."inventory_catalogue"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_settings_warehouse_id_sites_id_fk'
  ) THEN
    ALTER TABLE "stock_settings"
      ADD CONSTRAINT "stock_settings_warehouse_id_sites_id_fk"
      FOREIGN KEY ("warehouse_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "stock_settings_catalogue_warehouse_unique"
  ON "stock_settings" USING btree ("catalogue_id","warehouse_id");

CREATE INDEX IF NOT EXISTS "stock_settings_warehouse_item_idx"
  ON "stock_settings" USING btree ("catalogue_id","warehouse_id");

INSERT INTO "stock_settings" (
  "catalogue_id",
  "warehouse_id",
  "min_level",
  "max_level",
  "safety_stock_level",
  "zone_location",
  "created_at",
  "updated_at"
)
SELECT
  s."catalogue_id",
  s."warehouse_id",
  s."min_level",
  s."max_level",
  s."safety_stock_level",
  s."zone_location",
  COALESCE(s."created_at", now()),
  COALESCE(s."updated_at", now())
FROM "inventory_stock" s
ON CONFLICT ("catalogue_id", "warehouse_id")
DO UPDATE SET
  "min_level" = EXCLUDED."min_level",
  "max_level" = EXCLUDED."max_level",
  "safety_stock_level" = EXCLUDED."safety_stock_level",
  "zone_location" = EXCLUDED."zone_location",
  "updated_at" = now();
