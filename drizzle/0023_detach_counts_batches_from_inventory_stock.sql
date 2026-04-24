ALTER TABLE "inventory_batches" ADD COLUMN IF NOT EXISTS "stock_card_id" integer;
ALTER TABLE "inventory_count_lines" ADD COLUMN IF NOT EXISTS "catalogue_id" integer;
ALTER TABLE "inventory_count_lines" ADD COLUMN IF NOT EXISTS "warehouse_id" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_batches_stock_card_id_stock_cards_id_fk'
  ) THEN
    ALTER TABLE "inventory_batches"
      ADD CONSTRAINT "inventory_batches_stock_card_id_stock_cards_id_fk"
      FOREIGN KEY ("stock_card_id") REFERENCES "public"."stock_cards"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_count_lines_catalogue_id_inventory_catalogue_id_fk'
  ) THEN
    ALTER TABLE "inventory_count_lines"
      ADD CONSTRAINT "inventory_count_lines_catalogue_id_inventory_catalogue_id_fk"
      FOREIGN KEY ("catalogue_id") REFERENCES "public"."inventory_catalogue"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_count_lines_warehouse_id_sites_id_fk'
  ) THEN
    ALTER TABLE "inventory_count_lines"
      ADD CONSTRAINT "inventory_count_lines_warehouse_id_sites_id_fk"
      FOREIGN KEY ("warehouse_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

UPDATE "inventory_count_lines" icl
SET
  "catalogue_id" = s."catalogue_id",
  "warehouse_id" = s."warehouse_id"
FROM "inventory_stock" s
WHERE icl."stock_id" = s."id"
  AND (icl."catalogue_id" IS NULL OR icl."warehouse_id" IS NULL);

UPDATE "inventory_batches" ib
SET "stock_card_id" = sc."id"
FROM "inventory_stock" s
JOIN "stock_cards" sc ON sc."location_id" = s."warehouse_id"
JOIN "commodity_tracking_numbers" ctn ON ctn."id" = sc."ctn_id" AND ctn."item_id" = s."catalogue_id"
WHERE ib."stock_id" = s."id"
  AND ib."stock_card_id" IS NULL;
