ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'critical_stock';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'expiry_warning_90';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'expiry_warning_60';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'expiry_warning_30';

CREATE TABLE "inventory_counts" (
  "id" serial PRIMARY KEY NOT NULL,
  "count_number" varchar(100) NOT NULL,
  "count_type" varchar(50) NOT NULL,
  "warehouse_id" integer NOT NULL,
  "status" varchar(50) DEFAULT 'draft',
  "scope" json,
  "planned_start_date" date,
  "actual_started_at" timestamp,
  "completed_at" timestamp,
  "conducted_by" integer,
  "approved_by" integer,
  "notes" text,
  "variance_count" integer,
  "total_items_counted" integer,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "inventory_counts_count_number_unique" UNIQUE("count_number")
);

CREATE TABLE "inventory_count_lines" (
  "id" serial PRIMARY KEY NOT NULL,
  "count_id" integer NOT NULL,
  "stock_id" integer NOT NULL,
  "expected_quantity" double precision,
  "actual_quantity" double precision,
  "variance_quantity" double precision,
  "variance_percent" double precision,
  "variance_reason" varchar(255),
  "variance_notes" text,
  "counted_by" integer,
  "counted_at" timestamp
);

ALTER TABLE "inventory_counts"
  ADD CONSTRAINT "inventory_counts_warehouse_id_sites_id_fk"
  FOREIGN KEY ("warehouse_id") REFERENCES "sites"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_counts"
  ADD CONSTRAINT "inventory_counts_conducted_by_users_id_fk"
  FOREIGN KEY ("conducted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_counts"
  ADD CONSTRAINT "inventory_counts_approved_by_users_id_fk"
  FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "inventory_count_lines"
  ADD CONSTRAINT "inventory_count_lines_count_id_inventory_counts_id_fk"
  FOREIGN KEY ("count_id") REFERENCES "inventory_counts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_count_lines"
  ADD CONSTRAINT "inventory_count_lines_stock_id_inventory_stock_id_fk"
  FOREIGN KEY ("stock_id") REFERENCES "inventory_stock"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_count_lines"
  ADD CONSTRAINT "inventory_count_lines_counted_by_users_id_fk"
  FOREIGN KEY ("counted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
