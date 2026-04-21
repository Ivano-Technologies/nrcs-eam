CREATE TYPE "public"."facility_type" AS ENUM('branch', 'division', 'clinic', 'warehouse');--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "facilityType" "facility_type" DEFAULT 'branch' NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "parentFacilityId" integer;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_parentFacilityId_sites_id_fk" FOREIGN KEY ("parentFacilityId") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
