DO $$ BEGIN
 CREATE TYPE "public"."transfer_note_status" AS ENUM('pending_approval', 'approved', 'dispatched', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transfer_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tn_number" varchar(100) NOT NULL,
	"from_warehouse_id" integer NOT NULL,
	"to_warehouse_id" integer NOT NULL,
	"status" "transfer_note_status" DEFAULT 'pending_approval' NOT NULL,
	"reference_document" varchar(255),
	"transport_details" jsonb,
	"notes" text,
	"approved_by" integer,
	"approved_at" timestamp,
	"dispatched_at" timestamp,
	"completed_at" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transfer_notes_tn_number_unique" UNIQUE("tn_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transfer_note_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_note_id" integer NOT NULL,
	"catalogue_id" integer NOT NULL,
	"quantity" double precision NOT NULL,
	"line_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transfer_note_line_ctn_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_note_line_id" integer NOT NULL,
	"ctn_id" integer NOT NULL,
	"quantity" double precision NOT NULL,
	"override_by_user_id" integer,
	"override_at" timestamp,
	"override_reason" text,
	"source_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfer_notes" ADD CONSTRAINT "transfer_notes_from_warehouse_id_sites_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfer_notes" ADD CONSTRAINT "transfer_notes_to_warehouse_id_sites_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfer_notes" ADD CONSTRAINT "transfer_notes_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfer_notes" ADD CONSTRAINT "transfer_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfer_note_lines" ADD CONSTRAINT "transfer_note_lines_transfer_note_id_transfer_notes_id_fk" FOREIGN KEY ("transfer_note_id") REFERENCES "public"."transfer_notes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfer_note_lines" ADD CONSTRAINT "transfer_note_lines_catalogue_id_inventory_catalogue_id_fk" FOREIGN KEY ("catalogue_id") REFERENCES "public"."inventory_catalogue"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfer_note_line_ctn_sources" ADD CONSTRAINT "transfer_note_line_ctn_sources_line_id_fk" FOREIGN KEY ("transfer_note_line_id") REFERENCES "public"."transfer_note_lines"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfer_note_line_ctn_sources" ADD CONSTRAINT "transfer_note_line_ctn_sources_ctn_id_fk" FOREIGN KEY ("ctn_id") REFERENCES "public"."commodity_tracking_numbers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfer_note_line_ctn_sources" ADD CONSTRAINT "transfer_note_line_ctn_sources_override_by_users_id_fk" FOREIGN KEY ("override_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_notes_from_warehouse_idx" ON "transfer_notes" USING btree ("from_warehouse_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_notes_to_warehouse_idx" ON "transfer_notes" USING btree ("to_warehouse_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_notes_status_idx" ON "transfer_notes" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_note_lines_transfer_note_idx" ON "transfer_note_lines" USING btree ("transfer_note_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_note_line_ctn_sources_line_idx" ON "transfer_note_line_ctn_sources" USING btree ("transfer_note_line_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_note_line_ctn_sources_ctn_idx" ON "transfer_note_line_ctn_sources" USING btree ("ctn_id");
