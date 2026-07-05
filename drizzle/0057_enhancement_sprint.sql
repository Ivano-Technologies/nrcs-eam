-- Enhancement sprint: scheduled report types, quarterly schedule, notification prefs, verification campaigns, scorecard snapshots

ALTER TYPE "scheduled_report_type" ADD VALUE IF NOT EXISTS 'fleetHealth';
ALTER TYPE "scheduled_report_type" ADD VALUE IF NOT EXISTS 'donorStatement';
ALTER TYPE "scheduled_report_type" ADD VALUE IF NOT EXISTS 'branchScorecards';
ALTER TYPE "report_schedule" ADD VALUE IF NOT EXISTS 'quarterly';

ALTER TABLE "notificationPreferences"
  ADD COLUMN IF NOT EXISTS "expiryDigest" boolean DEFAULT true NOT NULL;

CREATE TYPE "verification_campaign_status" AS ENUM ('draft', 'active', 'closed');
CREATE TYPE "verification_method" AS ENUM ('scan', 'manual');

CREATE TABLE IF NOT EXISTS "verificationCampaigns" (
  "id" serial PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "startsAt" timestamp NOT NULL,
  "endsAt" timestamp NOT NULL,
  "status" "verification_campaign_status" DEFAULT 'draft' NOT NULL,
  "createdBy" integer NOT NULL,
  "scopeType" varchar(32) DEFAULT 'all_sites' NOT NULL,
  "siteIds" jsonb,
  "closedSummary" jsonb,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "assetVerifications" (
  "id" serial PRIMARY KEY,
  "campaignId" integer NOT NULL REFERENCES "verificationCampaigns"("id"),
  "assetId" integer NOT NULL,
  "verifiedBy" integer NOT NULL,
  "verifiedAt" timestamp DEFAULT now() NOT NULL,
  "method" "verification_method" NOT NULL,
  "condition" varchar(64),
  "locationSiteId" integer NOT NULL,
  "notes" text,
  "photoDocumentId" integer,
  "manualReason" text,
  UNIQUE ("campaignId", "assetId")
);

CREATE INDEX IF NOT EXISTS "idx_asset_verifications_campaign" ON "assetVerifications" ("campaignId");
CREATE INDEX IF NOT EXISTS "idx_asset_verifications_asset" ON "assetVerifications" ("assetId");

ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "lastVerificationCampaignId" integer,
  ADD COLUMN IF NOT EXISTS "notVerifiedCampaignName" varchar(255);

CREATE TABLE IF NOT EXISTS "branchScorecardSnapshots" (
  "id" serial PRIMARY KEY,
  "branchId" integer NOT NULL,
  "month" varchar(7) NOT NULL,
  "metrics" jsonb NOT NULL,
  "compositeScore" numeric(5, 2) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("branchId", "month")
);

CREATE INDEX IF NOT EXISTS "idx_branch_scorecard_snapshots_month" ON "branchScorecardSnapshots" ("month");
