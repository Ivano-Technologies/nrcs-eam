CREATE TABLE "requisitions" (
  "id" serial PRIMARY KEY NOT NULL,
  "req_number" varchar(100) NOT NULL,
  "title" varchar(255) NOT NULL,
  "status" varchar(50) DEFAULT 'draft',
  "priority" varchar(50) DEFAULT 'routine',
  "requested_by" integer NOT NULL,
  "requesting_facility" integer NOT NULL,
  "justification" text NOT NULL,
  "incident_reference" varchar(255),
  "affected_population" integer,
  "items" json,
  "suggested_warehouse_id" integer,
  "approved_branch_by" integer,
  "approved_branch_at" timestamp,
  "approved_hq_by" integer,
  "approved_hq_at" timestamp,
  "rejected_by" integer,
  "rejection_reason" text,
  "fulfilled_at" timestamp,
  "linked_waybills" json,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "requisitions_req_number_unique" UNIQUE("req_number")
);

CREATE TABLE "distributions" (
  "id" serial PRIMARY KEY NOT NULL,
  "distribution_number" varchar(100) NOT NULL,
  "waybill_id" integer,
  "incident_reference" varchar(255),
  "distribution_date" date NOT NULL,
  "location" varchar(500) NOT NULL,
  "latitude" double precision,
  "longitude" double precision,
  "location_type" varchar(100),
  "beneficiary_count" integer,
  "household_count" integer,
  "male_count" integer,
  "female_count" integer,
  "children_count" integer,
  "elderly_count" integer,
  "pwd_count" integer,
  "items_distributed" json,
  "conducted_by" integer,
  "team_members" json,
  "observers" text,
  "photos" json,
  "beneficiary_list" json,
  "notes" text,
  "challenges" text,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "distributions_distribution_number_unique" UNIQUE("distribution_number")
);

CREATE TABLE "inventory_kits" (
  "id" serial PRIMARY KEY NOT NULL,
  "kit_code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "kit_type" varchar(100),
  "catalogue_id" integer,
  "components" json NOT NULL,
  "is_active" boolean DEFAULT true,
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "inventory_kits_kit_code_unique" UNIQUE("kit_code")
);

CREATE TABLE "kit_assemblies" (
  "id" serial PRIMARY KEY NOT NULL,
  "kit_id" integer NOT NULL,
  "warehouse_id" integer NOT NULL,
  "direction" varchar(20) NOT NULL,
  "quantity" integer NOT NULL,
  "performed_by" integer,
  "performed_at" timestamp DEFAULT now(),
  "notes" text
);

ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_requesting_facility_sites_id_fk" FOREIGN KEY ("requesting_facility") REFERENCES "sites"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_suggested_warehouse_id_sites_id_fk" FOREIGN KEY ("suggested_warehouse_id") REFERENCES "sites"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_approved_branch_by_users_id_fk" FOREIGN KEY ("approved_branch_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_approved_hq_by_users_id_fk" FOREIGN KEY ("approved_hq_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "distributions" ADD CONSTRAINT "distributions_waybill_id_inventory_documents_id_fk" FOREIGN KEY ("waybill_id") REFERENCES "inventory_documents"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "distributions" ADD CONSTRAINT "distributions_conducted_by_users_id_fk" FOREIGN KEY ("conducted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_kits" ADD CONSTRAINT "inventory_kits_catalogue_id_inventory_catalogue_id_fk" FOREIGN KEY ("catalogue_id") REFERENCES "inventory_catalogue"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "kit_assemblies" ADD CONSTRAINT "kit_assemblies_kit_id_inventory_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "inventory_kits"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "kit_assemblies" ADD CONSTRAINT "kit_assemblies_warehouse_id_sites_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "sites"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "kit_assemblies" ADD CONSTRAINT "kit_assemblies_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
