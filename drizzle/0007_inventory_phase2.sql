CREATE TABLE "inventory_batches" (
  "id" serial PRIMARY KEY NOT NULL,
  "stock_id" integer NOT NULL,
  "batch_number" varchar(100),
  "expiry_date" date,
  "manufacture_date" date,
  "quantity" double precision NOT NULL,
  "supplier_name" varchar(255),
  "received_date" timestamp DEFAULT now(),
  "notes" text,
  "status" varchar(50) DEFAULT 'active'
);

CREATE TABLE "inventory_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "document_type" varchar(50) NOT NULL,
  "document_number" varchar(100) NOT NULL,
  "status" varchar(50) DEFAULT 'draft',
  "from_warehouse_id" integer,
  "to_warehouse_id" integer,
  "items" json,
  "reference_document" varchar(255),
  "transport_details" json,
  "attachments" json,
  "notes" text,
  "created_by" integer,
  "approved_by" integer,
  "created_at" timestamp DEFAULT now(),
  "approved_at" timestamp,
  "completed_at" timestamp,
  CONSTRAINT "inventory_documents_document_number_unique" UNIQUE("document_number")
);

CREATE TABLE "inventory_movements" (
  "id" serial PRIMARY KEY NOT NULL,
  "movement_type" varchar(50) NOT NULL,
  "catalogue_id" integer NOT NULL,
  "stock_id" integer,
  "batch_id" integer,
  "from_warehouse_id" integer,
  "to_warehouse_id" integer,
  "quantity_change" double precision NOT NULL,
  "balance_after" double precision NOT NULL,
  "document_type" varchar(50),
  "document_id" integer,
  "document_number" varchar(100),
  "performed_by" integer,
  "approved_by" integer,
  "reason" varchar(255),
  "notes" text,
  "created_at" timestamp DEFAULT now()
);

ALTER TABLE "inventory_batches"
  ADD CONSTRAINT "inventory_batches_stock_id_inventory_stock_id_fk"
  FOREIGN KEY ("stock_id") REFERENCES "inventory_stock"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "inventory_documents"
  ADD CONSTRAINT "inventory_documents_from_warehouse_id_sites_id_fk"
  FOREIGN KEY ("from_warehouse_id") REFERENCES "sites"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_documents"
  ADD CONSTRAINT "inventory_documents_to_warehouse_id_sites_id_fk"
  FOREIGN KEY ("to_warehouse_id") REFERENCES "sites"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_documents"
  ADD CONSTRAINT "inventory_documents_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_documents"
  ADD CONSTRAINT "inventory_documents_approved_by_users_id_fk"
  FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_catalogue_id_inventory_catalogue_id_fk"
  FOREIGN KEY ("catalogue_id") REFERENCES "inventory_catalogue"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_stock_id_inventory_stock_id_fk"
  FOREIGN KEY ("stock_id") REFERENCES "inventory_stock"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_batch_id_inventory_batches_id_fk"
  FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_from_warehouse_id_sites_id_fk"
  FOREIGN KEY ("from_warehouse_id") REFERENCES "sites"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_to_warehouse_id_sites_id_fk"
  FOREIGN KEY ("to_warehouse_id") REFERENCES "sites"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_performed_by_users_id_fk"
  FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_approved_by_users_id_fk"
  FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
