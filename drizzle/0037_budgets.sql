CREATE TABLE IF NOT EXISTS "budgets" (
  "id" serial PRIMARY KEY NOT NULL,
  "siteId" integer,
  "categoryId" integer,
  "period" integer NOT NULL,
  "amount" numeric(18, 2) NOT NULL,
  "createdBy" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "budgets" ADD CONSTRAINT "budgets_siteId_sites_id_fk"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_assetCategories_id_fk"
    FOREIGN KEY ("categoryId") REFERENCES "assetCategories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "budgets" ADD CONSTRAINT "budgets_createdBy_users_id_fk"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "budgets_siteId_idx" ON "budgets" ("siteId");
CREATE INDEX IF NOT EXISTS "budgets_period_idx" ON "budgets" ("period");
