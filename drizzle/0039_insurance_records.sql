CREATE TABLE IF NOT EXISTS "insurance_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "assetId" integer,
  "siteId" integer,
  "insuranceType" varchar(64) NOT NULL,
  "insurer" varchar(255) NOT NULL,
  "policyNumber" varchar(128) NOT NULL,
  "insuredValueNgn" numeric(18, 2),
  "annualPremiumNgn" numeric(18, 2),
  "policyStart" date NOT NULL,
  "policyEnd" date NOT NULL,
  "notes" text,
  "createdBy" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "insurance_records" ADD CONSTRAINT "insurance_records_assetId_assets_id_fk"
    FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "insurance_records" ADD CONSTRAINT "insurance_records_siteId_sites_id_fk"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "insurance_records" ADD CONSTRAINT "insurance_records_createdBy_users_id_fk"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "insurance_records_siteId_idx" ON "insurance_records" ("siteId");
CREATE INDEX IF NOT EXISTS "insurance_records_policyEnd_idx" ON "insurance_records" ("policyEnd");
