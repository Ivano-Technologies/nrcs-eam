CREATE TABLE "inventory_catalogue" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) NOT NULL,
	"subcategory" varchar(100),
	"unit_of_measure" varchar(50) NOT NULL,
	"ved_classification" varchar(20),
	"unit_weight_kg" double precision,
	"pack_size" integer,
	"pack_unit" varchar(50),
	"has_expiry" boolean DEFAULT false,
	"cold_chain_required" boolean DEFAULT false,
	"photo_url" varchar(500),
	"standard_suppliers" json,
	"ifrc_item_code" varchar(50),
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "inventory_catalogue_item_code_unique" UNIQUE("item_code")
);
--> statement-breakpoint
CREATE TABLE "inventory_stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"catalogue_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"zone_location" varchar(100),
	"quantity_on_hand" double precision DEFAULT 0 NOT NULL,
	"quantity_reserved" double precision DEFAULT 0,
	"quantity_in_transit" double precision DEFAULT 0,
	"min_level" double precision DEFAULT 0,
	"max_level" double precision,
	"safety_stock_level" double precision,
	"last_counted_at" timestamp,
	"last_movement_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "inventory_stock_catalogue_warehouse_unique" UNIQUE("catalogue_id","warehouse_id")
);
--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_catalogue_id_inventory_catalogue_id_fk" FOREIGN KEY ("catalogue_id") REFERENCES "public"."inventory_catalogue"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_warehouse_id_sites_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
