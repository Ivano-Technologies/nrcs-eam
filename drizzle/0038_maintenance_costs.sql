CREATE TABLE IF NOT EXISTS "maintenance_costs" (
  "id" serial PRIMARY KEY NOT NULL,
  "assetId" integer NOT NULL,
  "maintenanceType" varchar(64) NOT NULL,
  "date" date NOT NULL,
  "costNgn" numeric(18, 2) NOT NULL,
  "description" text,
  "referenceNumber" varchar(128),
  "loggedBy" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "maintenance_costs" ADD CONSTRAINT "maintenance_costs_assetId_assets_id_fk"
    FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "maintenance_costs" ADD CONSTRAINT "maintenance_costs_loggedBy_users_id_fk"
    FOREIGN KEY ("loggedBy") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "maintenance_costs_assetId_idx" ON "maintenance_costs" ("assetId");
CREATE INDEX IF NOT EXISTS "maintenance_costs_date_idx" ON "maintenance_costs" ("date");
