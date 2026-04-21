CREATE TYPE "public"."item_category" AS ENUM(
  'food_nutrition',
  'shelter_nfi',
  'wash',
  'medical_supplies',
  'emergency_kits',
  'equipment_tools',
  'other'
);
--> statement-breakpoint
ALTER TABLE "inventory_catalogue" ADD COLUMN "item_category" "item_category" DEFAULT 'other' NOT NULL;
--> statement-breakpoint
UPDATE "inventory_catalogue" SET "item_category" = 'other' WHERE "item_category" IS NULL;
