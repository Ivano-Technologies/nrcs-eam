ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "itemType" varchar(20);--> statement-breakpoint
UPDATE "assets" SET "itemType" = 'asset' WHERE "itemType" IS NULL;--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "itemType" SET DEFAULT 'asset';--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "itemType" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "subCategory" varchar(255);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "acquisitionMethod" varchar(100);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "projectRef" varchar(255);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "acquisitionCondition" varchar(50);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "department" varchar(255);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "lastCheckedAt" timestamp;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "checkedBy" varchar(255);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "physicalCondition" varchar(50);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "registerStatus" varchar(50);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "assignedToName" varchar(255);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "currentDepreciatedValue" double precision;--> statement-breakpoint
UPDATE "assets" SET "registerStatus" = CASE "status"::text
  WHEN 'operational' THEN 'in_use'
  WHEN 'maintenance' THEN 'under_maintenance'
  WHEN 'repair' THEN 'out_of_order'
  WHEN 'retired' THEN 'to_be_disposed'
  WHEN 'disposed' THEN 'disposed'
  ELSE 'in_use'
END WHERE "registerStatus" IS NULL;--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "registerStatus" SET DEFAULT 'in_use';--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "registerStatus" SET NOT NULL;
