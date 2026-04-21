ALTER TABLE "sites" ADD COLUMN "code" varchar(64);--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "postalCode" varchar(32);--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_code_unique" UNIQUE("code");
