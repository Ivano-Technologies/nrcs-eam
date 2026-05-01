ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "item_type" varchar(20);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'assets'::regclass
      AND tgname = 'trg_nrcs_generate_asset_code'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE "assets" DISABLE TRIGGER "trg_nrcs_generate_asset_code";
  END IF;
END $$;

UPDATE "assets"
SET "item_type" = CASE
  WHEN coalesce("item_type", '') IN ('Asset', 'Inventory') THEN "item_type"
  WHEN coalesce("itemType", '') IN ('asset', 'Asset') THEN 'Asset'
  WHEN coalesce("itemType", '') IN ('inventory', 'Inventory') THEN 'Inventory'
  ELSE 'Asset'
END
WHERE "item_type" IS NULL OR "item_type" NOT IN ('Asset', 'Inventory');

ALTER TABLE "assets"
  ALTER COLUMN "item_type" SET DEFAULT 'Asset';

ALTER TABLE "assets"
  ALTER COLUMN "item_type" SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_register_item_type_ck') THEN
    ALTER TABLE "assets"
      ADD CONSTRAINT "assets_register_item_type_ck"
      CHECK ("item_type" IN ('Asset', 'Inventory'));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'assets'::regclass
      AND tgname = 'trg_nrcs_generate_asset_code'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE "assets" ENABLE TRIGGER "trg_nrcs_generate_asset_code";
  END IF;
END $$;
