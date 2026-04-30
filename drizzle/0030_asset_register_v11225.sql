ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "item_category" varchar,
  ADD COLUMN IF NOT EXISTS "item_category_code" varchar(2),
  ADD COLUMN IF NOT EXISTS "sub_item_category" varchar,
  ADD COLUMN IF NOT EXISTS "item_description" text,
  ADD COLUMN IF NOT EXISTS "branch_code" varchar,
  ADD COLUMN IF NOT EXISTS "asset_num" integer,
  ADD COLUMN IF NOT EXISTS "asset_code" varchar,
  ADD COLUMN IF NOT EXISTS "actual_unit_value" numeric(15,2),
  ADD COLUMN IF NOT EXISTS "depreciated_value" numeric(15,2),
  ADD COLUMN IF NOT EXISTS "acquisition_other_detail" varchar,
  ADD COLUMN IF NOT EXISTS "year_acquired" integer,
  ADD COLUMN IF NOT EXISTS "acquired_new_or_used" varchar,
  ADD COLUMN IF NOT EXISTS "current_status" varchar,
  ADD COLUMN IF NOT EXISTS "current_location" varchar,
  ADD COLUMN IF NOT EXISTS "condition" varchar,
  ADD COLUMN IF NOT EXISTS "last_physical_check" date,
  ADD COLUMN IF NOT EXISTS "check_conducted_by" varchar,
  ADD COLUMN IF NOT EXISTS "remarks" text;

UPDATE "assets"
SET "item_type" = CASE
  WHEN coalesce("item_type", '') IN ('asset', 'Asset') THEN 'Asset'
  WHEN coalesce("item_type", '') IN ('inventory', 'Inventory') THEN 'Inventory'
  ELSE 'Asset'
END
WHERE "item_type" IS NULL OR "item_type" NOT IN ('Asset', 'Inventory');

UPDATE "assets"
SET
  "sub_item_category" = coalesce("sub_item_category", "subCategory"),
  "item_description" = coalesce("item_description", "name"),
  "actual_unit_value" = coalesce("actual_unit_value", nullif("acquisitionCost", '')::numeric),
  "depreciated_value" = coalesce("depreciated_value", "currentDepreciatedValue"),
  "year_acquired" = coalesce("year_acquired", extract(year from "acquisitionDate")::int),
  "acquired_new_or_used" = coalesce("acquired_new_or_used", "acquisitionCondition"),
  "current_status" = coalesce("current_status",
    CASE "registerStatus"
      WHEN 'in_use' THEN 'In Use'
      WHEN 'in_store' THEN 'In Store'
      WHEN 'under_maintenance' THEN 'Under Maintenance'
      WHEN 'disposed' THEN 'Disposed'
      WHEN 'to_be_disposed' THEN 'To be Disposed'
      ELSE null
    END
  ),
  "current_location" = coalesce("current_location", "location"),
  "condition" = coalesce("condition", "physicalCondition"),
  "last_physical_check" = coalesce("last_physical_check", "lastCheckedAt"::date),
  "check_conducted_by" = coalesce("check_conducted_by", "checkedBy"),
  "remarks" = coalesce("remarks", "notes"),
  "asset_code" = coalesce("asset_code", "assetTag")
WHERE true;

ALTER TABLE "assets"
  ADD CONSTRAINT IF NOT EXISTS "assets_item_type_ck"
    CHECK ("item_type" IN ('Asset', 'Inventory')),
  ADD CONSTRAINT IF NOT EXISTS "assets_item_category_code_ck"
    CHECK ("item_category_code" IN ('CO', 'FF', 'GE', 'LA', 'LB', 'ME', 'OE', 'VE') OR "item_category_code" IS NULL),
  ADD CONSTRAINT IF NOT EXISTS "assets_method_of_acquisition_ck"
    CHECK ("acquisitionMethod" IN ('Donated By ICRC','Donated By IFRC','Donated by Other Donor','Purchase Through Project','Purchase Through Internal Funding','Other') OR "acquisitionMethod" IS NULL),
  ADD CONSTRAINT IF NOT EXISTS "assets_acquired_new_or_used_ck"
    CHECK ("acquired_new_or_used" IN ('New','Used') OR "acquired_new_or_used" IS NULL),
  ADD CONSTRAINT IF NOT EXISTS "assets_current_status_ck"
    CHECK ("current_status" IN ('In Use','In Store','Under Maintenance','Disposed','To be Disposed') OR "current_status" IS NULL),
  ADD CONSTRAINT IF NOT EXISTS "assets_condition_ck"
    CHECK ("condition" IN ('Good','Fair','Damaged','Beyond Repair (For Disposal)','Out of Order (To be repaired)') OR "condition" IS NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_branch_code_sites_code_fk'
  ) THEN
    ALTER TABLE "assets"
      ADD CONSTRAINT "assets_branch_code_sites_code_fk"
      FOREIGN KEY ("branch_code")
      REFERENCES "sites"("code")
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "assets_asset_code_unique_idx" ON "assets" ("asset_code");
CREATE UNIQUE INDEX IF NOT EXISTS "assets_branch_category_num_unique_idx"
  ON "assets" ("branch_code", "item_category_code", "asset_num");

CREATE TABLE IF NOT EXISTS "asset_approvals" (
  "id" serial PRIMARY KEY NOT NULL,
  "site_id" integer NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
  "period" varchar(64) NOT NULL,
  "updated_by_name" varchar(255),
  "updated_by_designation" varchar(255),
  "updated_by_date" date,
  "approved_by_name" varchar(255),
  "approved_by_designation" varchar(255),
  "approved_by_date" date,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "asset_approvals_site_period_unique_idx"
  ON "asset_approvals" ("site_id", "period");
