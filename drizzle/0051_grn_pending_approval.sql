ALTER TYPE "public"."grn_status" ADD VALUE IF NOT EXISTS 'pending_approval';
--> statement-breakpoint
ALTER TABLE "goods_received_notes" ADD COLUMN IF NOT EXISTS "country_code" varchar(8) DEFAULT 'NG';
--> statement-breakpoint
ALTER TABLE "goods_received_notes" ADD COLUMN IF NOT EXISTS "finalized_by" integer;
--> statement-breakpoint
ALTER TABLE "goods_received_notes" ADD COLUMN IF NOT EXISTS "finalized_at" timestamp;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goods_received_notes" ADD CONSTRAINT "goods_received_notes_finalized_by_users_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
