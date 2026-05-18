CREATE TABLE IF NOT EXISTS "vehicle_compliance" (
  "id" serial PRIMARY KEY NOT NULL,
  "assetId" integer NOT NULL,
  "plateNumber" varchar(32),
  "roadWorthinessExpiry" date,
  "insuranceExpiry" date,
  "licenceExpiry" date,
  "lastInspectionDate" date,
  "notes" text,
  "createdBy" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "generator_compliance" (
  "id" serial PRIMARY KEY NOT NULL,
  "assetId" integer NOT NULL,
  "lastServiceDate" date,
  "nextServiceDue" date,
  "serviceProvider" varchar(255),
  "runningHoursAtService" integer,
  "safetyCertExpiry" date,
  "notes" text,
  "createdBy" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "building_safety" (
  "id" serial PRIMARY KEY NOT NULL,
  "siteId" integer NOT NULL,
  "certificateType" varchar(64) NOT NULL,
  "issuingAuthority" varchar(255),
  "certificateNumber" varchar(128),
  "issueDate" date,
  "expiryDate" date,
  "notes" text,
  "createdBy" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "donor_reporting" (
  "id" serial PRIMARY KEY NOT NULL,
  "donorName" varchar(255) NOT NULL,
  "programmeRef" varchar(255),
  "assetId" integer,
  "siteId" integer,
  "reportType" varchar(32) NOT NULL,
  "dueDate" date NOT NULL,
  "submittedDate" date,
  "status" varchar(32),
  "notes" text,
  "createdBy" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "vehicle_compliance" ADD CONSTRAINT "vehicle_compliance_assetId_assets_id_fk"
    FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "generator_compliance" ADD CONSTRAINT "generator_compliance_assetId_assets_id_fk"
    FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "building_safety" ADD CONSTRAINT "building_safety_siteId_sites_id_fk"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "donor_reporting" ADD CONSTRAINT "donor_reporting_assetId_assets_id_fk"
    FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "donor_reporting" ADD CONSTRAINT "donor_reporting_siteId_sites_id_fk"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "vehicle_compliance_assetId_idx" ON "vehicle_compliance" ("assetId");
CREATE INDEX IF NOT EXISTS "generator_compliance_assetId_idx" ON "generator_compliance" ("assetId");
CREATE INDEX IF NOT EXISTS "building_safety_siteId_idx" ON "building_safety" ("siteId");
CREATE INDEX IF NOT EXISTS "donor_reporting_dueDate_idx" ON "donor_reporting" ("dueDate");
