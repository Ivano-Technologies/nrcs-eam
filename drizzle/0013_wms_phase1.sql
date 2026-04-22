CREATE TYPE "public"."donor_type" AS ENUM('national_society', 'multilateral', 'corporate', 'government', 'individual');
--> statement-breakpoint
CREATE TYPE "public"."wms_means_of_transport" AS ENUM('road', 'rail', 'air', 'sea', 'handcarried');
--> statement-breakpoint
CREATE TYPE "public"."grn_status" AS ENUM('draft', 'finalized', 'claim_raised');
--> statement-breakpoint
CREATE TYPE "public"."waybill_doc_type" AS ENUM('waybill', 'delivery_note');
--> statement-breakpoint
CREATE TYPE "public"."waybill_status" AS ENUM('draft', 'dispatched', 'received', 'claim_raised');
--> statement-breakpoint
CREATE TYPE "public"."wms_stock_movement_source" AS ENUM('grn', 'waybill', 'stock_check', 'adjustment', 'import');
--> statement-breakpoint
CREATE TYPE "public"."ctn_registry_status" AS ENUM('active', 'locked', 'depleted');
--> statement-breakpoint
CREATE TYPE "public"."wms_doc_type" AS ENUM('grn', 'waybill');
--> statement-breakpoint
CREATE TYPE "public"."bin_card_status" AS ENUM('open', 'closed');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "donors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(32) NOT NULL UNIQUE,
	"type" "donor_type" NOT NULL,
	"country" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donors_type_idx" ON "donors" ("type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commodity_tracking_numbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"ctn_code" varchar(64) NOT NULL UNIQUE,
	"donor_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"received_date" date,
	"expiry_date" date,
	"unit" varchar(50) NOT NULL,
	"original_quantity" double precision NOT NULL,
	"notes" text,
	"status" "ctn_registry_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commodity_tracking_numbers" ADD CONSTRAINT "commodity_tracking_numbers_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commodity_tracking_numbers" ADD CONSTRAINT "commodity_tracking_numbers_item_id_inventory_catalogue_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_catalogue"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ctn_donor_idx" ON "commodity_tracking_numbers" ("donor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ctn_item_idx" ON "commodity_tracking_numbers" ("item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ctn_expiry_idx" ON "commodity_tracking_numbers" ("expiry_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goods_received_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"grn_number" varchar(100) NOT NULL UNIQUE,
	"consignment_number" varchar(100),
	"delegation_location_id" integer NOT NULL,
	"received_from" varchar(500) NOT NULL,
	"date_of_arrival" date NOT NULL,
	"document_well_received" boolean DEFAULT true,
	"incomplete_documents_notes" text,
	"means_of_transport" "wms_means_of_transport",
	"awb_number" varchar(100),
	"waybill_cmr_number" varchar(100),
	"bl_number" varchar(100),
	"flight_number" varchar(100),
	"registration_number" varchar(100),
	"vessel_name" varchar(255),
	"delivered_by_name" varchar(255),
	"delivered_by_function" varchar(255),
	"delivered_by_date" date,
	"delivered_by_signature_url" text,
	"received_by_name" varchar(255),
	"received_by_function" varchar(255),
	"received_by_date" date,
	"received_by_signature_url" text,
	"comments" text,
	"status" "grn_status" DEFAULT 'draft' NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goods_received_notes" ADD CONSTRAINT "goods_received_notes_delegation_location_id_sites_id_fk" FOREIGN KEY ("delegation_location_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "goods_received_notes" ADD CONSTRAINT "goods_received_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grn_delegation_date_idx" ON "goods_received_notes" ("delegation_location_id","date_of_arrival");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goods_received_note_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"grn_id" integer NOT NULL,
	"consignment_number" varchar(100),
	"description" text NOT NULL,
	"ctn_or_donor" varchar(255),
	"ctn_id" integer,
	"nb_of_units" double precision NOT NULL,
	"unit_type" varchar(50) NOT NULL,
	"weight_kg" double precision,
	"received_in_good_condition" boolean DEFAULT true,
	"claim_notes" text,
	"line_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goods_received_note_lines" ADD CONSTRAINT "goods_received_note_lines_grn_id_goods_received_notes_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."goods_received_notes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "goods_received_note_lines" ADD CONSTRAINT "goods_received_note_lines_ctn_id_commodity_tracking_numbers_id_fk" FOREIGN KEY ("ctn_id") REFERENCES "public"."commodity_tracking_numbers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "lr_number" varchar(100);
--> statement-breakpoint
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "requesting_unit" varchar(255);
--> statement-breakpoint
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "purpose" text;
--> statement-breakpoint
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "authorized_by" integer;
--> statement-breakpoint
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "date_authorized" timestamp;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "requisitions_lr_number_unique" ON "requisitions" ("lr_number") WHERE "lr_number" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_authorized_by_users_id_fk" FOREIGN KEY ("authorized_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waybills" (
	"id" serial PRIMARY KEY NOT NULL,
	"wb_number" varchar(100) NOT NULL UNIQUE,
	"doc_type" "waybill_doc_type" NOT NULL,
	"country_code" varchar(8),
	"date" date NOT NULL,
	"warehouse_id" integer NOT NULL,
	"destination_beneficiary" text NOT NULL,
	"transport_contract_ref" varchar(255),
	"vehicle_1" varchar(255),
	"vehicle_2" varchar(255),
	"registration_1" varchar(100),
	"registration_2" varchar(100),
	"means_of_transport" "wms_means_of_transport",
	"etd" timestamp,
	"loaded_by_name" varchar(255),
	"loaded_by_date" date,
	"loaded_by_function" varchar(255),
	"loaded_by_signature_url" text,
	"transported_by_name" varchar(255),
	"transported_by_date" date,
	"transported_by_function" varchar(255),
	"transported_by_signature_url" text,
	"received_by_name" varchar(255),
	"received_by_date" date,
	"received_by_function" varchar(255),
	"received_by_signature_url" text,
	"received_at_location" varchar(500),
	"received_condition" text,
	"comments" text,
	"comments_from_receiver" text,
	"requisition_id" integer,
	"status" "waybill_status" DEFAULT 'draft' NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "waybills" ADD CONSTRAINT "waybills_warehouse_id_sites_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "waybills" ADD CONSTRAINT "waybills_requisition_id_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."requisitions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "waybills" ADD CONSTRAINT "waybills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waybill_warehouse_date_idx" ON "waybills" ("warehouse_id","date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waybill_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"waybill_id" integer NOT NULL,
	"item_description" text NOT NULL,
	"ctn_id" integer NOT NULL,
	"nb_of_units" double precision NOT NULL,
	"unit_type" varchar(50) NOT NULL,
	"weight_kg" double precision,
	"volume_m3" double precision,
	"requisition_line_id" varchar(64),
	"remarks" text,
	"line_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "waybill_lines" ADD CONSTRAINT "waybill_lines_waybill_id_waybills_id_fk" FOREIGN KEY ("waybill_id") REFERENCES "public"."waybills"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "waybill_lines" ADD CONSTRAINT "waybill_lines_ctn_id_commodity_tracking_numbers_id_fk" FOREIGN KEY ("ctn_id") REFERENCES "public"."commodity_tracking_numbers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"ctn_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"description" text,
	"item_code" varchar(50),
	"measure_unit" varchar(50),
	"expiry_date" date,
	"stock_minimum" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_card_ctn_location_unique" UNIQUE("ctn_id","location_id")
);
--> statement-breakpoint
ALTER TABLE "stock_cards" ADD CONSTRAINT "stock_cards_ctn_id_commodity_tracking_numbers_id_fk" FOREIGN KEY ("ctn_id") REFERENCES "public"."commodity_tracking_numbers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_cards" ADD CONSTRAINT "stock_cards_location_id_sites_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_card_location_idx" ON "stock_cards" ("location_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bin_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_card_id" integer NOT NULL,
	"bin_number" varchar(64) NOT NULL,
	"stock_location" varchar(255),
	"item_code" varchar(50),
	"item_description" text,
	"commodity_tracking_number" varchar(64),
	"donor_code" varchar(32),
	"unit" varchar(50),
	"expiry_date" date,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"status" "bin_card_status" DEFAULT 'open' NOT NULL,
	CONSTRAINT "bin_stock_card_number_unique" UNIQUE("stock_card_id","bin_number")
);
--> statement-breakpoint
ALTER TABLE "bin_cards" ADD CONSTRAINT "bin_cards_stock_card_id_stock_cards_id_fk" FOREIGN KEY ("stock_card_id") REFERENCES "public"."stock_cards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_card_id" integer NOT NULL,
	"bin_card_id" integer,
	"date" date NOT NULL,
	"document_ref" varchar(100),
	"from_to" varchar(500),
	"quantity_in" double precision DEFAULT 0 NOT NULL,
	"quantity_out" double precision DEFAULT 0 NOT NULL,
	"balance_after" double precision NOT NULL,
	"remarks" text,
	"storekeeper_initials" varchar(32),
	"signature_url" text,
	"source_type" "wms_stock_movement_source" NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_card_id_stock_cards_id_fk" FOREIGN KEY ("stock_card_id") REFERENCES "public"."stock_cards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_bin_card_id_bin_cards_id_fk" FOREIGN KEY ("bin_card_id") REFERENCES "public"."bin_cards"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_card_date_idx" ON "stock_movements" ("stock_card_id","date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_number_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"facility_id" integer NOT NULL,
	"doc_type" "wms_doc_type" NOT NULL,
	"year" integer NOT NULL,
	"prefix" varchar(32) NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "document_number_sequences_unique" UNIQUE("facility_id","doc_type","year")
);
--> statement-breakpoint
ALTER TABLE "document_number_sequences" ADD CONSTRAINT "document_number_sequences_facility_id_sites_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
