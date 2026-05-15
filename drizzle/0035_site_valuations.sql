CREATE TABLE IF NOT EXISTS "site_valuations" (
  "id" serial PRIMARY KEY NOT NULL,
  "siteId" integer NOT NULL,
  "valuationDate" date NOT NULL,
  "landAreaSqm" numeric(18, 4),
  "marketValue" numeric(18, 2) NOT NULL,
  "certifiedValue" numeric(18, 2) NOT NULL,
  "valuationReference" text,
  "valuedBy" text,
  "notes" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "site_valuations" ADD CONSTRAINT "site_valuations_siteId_sites_id_fk"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "site_valuations_siteId_idx" ON "site_valuations" ("siteId");

-- NRCS Asset Valuation Report 2026 — 27 rows (ANA-001 plot 1; ANA-004 plot 2)
INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 791::numeric, 76300000::numeric, 80000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'CRO-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 840.22::numeric, 25000000::numeric, 25000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'CRO-002';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 2000::numeric, 1700000000::numeric, 3000000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'NHQ-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 2592.84::numeric, 70000000::numeric, 75000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'LAG-WH1';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 4203.41::numeric, 850000000::numeric, 900000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'LAG-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 324::numeric, 1200000::numeric, 1200000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'LAG-002';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 3908.14::numeric, 280000000::numeric, 300000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'OYO-CL1';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 4526.30::numeric, 500000000::numeric, 600000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'OYO-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 1625.32::numeric, 200000000::numeric, 240000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'RIV-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 81205.86::numeric, 300000000::numeric, 360000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'NIG-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 5903.05::numeric, 1200000000::numeric, 1200000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'KAN-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 9734::numeric, 90000000::numeric, 90000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'KAN-CL1';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 3545.21::numeric, 500000000::numeric, 500000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'DEL-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 1433.42::numeric, 308235200::numeric, 308235200::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'ENU-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 6702.72::numeric, 365000000::numeric, 365000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'KAD-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 739.17::numeric, 35000000::numeric, 35000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'KAD-002';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 3297.83::numeric, 106381612::numeric, 106381612::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'BAY-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 1522.68::numeric, 130000000::numeric, 130000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'ABI-002';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 6702.72::numeric, 175000000::numeric, 175000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'BOR-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 6374.86::numeric, 400000000::numeric, 400000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'KWA-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 2539.22::numeric, 220000000::numeric, 220000000::numeric, 'NRCS Asset Valuation Report 2026', 'Plot 1 (Zik Avenue)', now(), now() FROM sites s WHERE s.code = 'ANA-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 2324.70::numeric, 45000000::numeric, 45000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'ANA-002';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 1600::numeric, 120000000::numeric, 120000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'ANA-003';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 1527.60::numeric, 350000000::numeric, 350000000::numeric, 'NRCS Asset Valuation Report 2026', 'Plot 2 (Zik Avenue)', now(), now() FROM sites s WHERE s.code = 'ANA-004';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 4250::numeric, 1480000000::numeric, 1480000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'EDO-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 4159.90::numeric, 40000000::numeric, 40000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'EKI-001';

INSERT INTO "site_valuations" ("siteId", "valuationDate", "landAreaSqm", "marketValue", "certifiedValue", "valuationReference", "notes", "createdAt", "updatedAt")
SELECT s.id, '2026-01-01'::date, 6374.86::numeric, 1050000000::numeric, 1050000000::numeric, 'NRCS Asset Valuation Report 2026', NULL, now(), now() FROM sites s WHERE s.code = 'IMO-001';
