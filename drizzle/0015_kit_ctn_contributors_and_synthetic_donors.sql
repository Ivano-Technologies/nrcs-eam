-- Decision 4: donor_type 'synthetic', kit_ctn_contributors, BLENDED / LEGACY donors.

ALTER TYPE "public"."donor_type" ADD VALUE IF NOT EXISTS 'synthetic';

CREATE TABLE IF NOT EXISTS "kit_ctn_contributors" (
	"id" serial PRIMARY KEY NOT NULL,
	"kit_ctn_id" integer NOT NULL,
	"component_ctn_id" integer NOT NULL,
	"component_donor_id" integer NOT NULL,
	"quantity_consumed" double precision NOT NULL,
	"assembly_event_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kit_ctn_contributors_kit_ctn_id_commodity_tracking_numbers_id_fk" FOREIGN KEY ("kit_ctn_id") REFERENCES "public"."commodity_tracking_numbers"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "kit_ctn_contributors_component_ctn_id_commodity_tracking_numbers_id_fk" FOREIGN KEY ("component_ctn_id") REFERENCES "public"."commodity_tracking_numbers"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "kit_ctn_contributors_component_donor_id_donors_id_fk" FOREIGN KEY ("component_donor_id") REFERENCES "public"."donors"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "kit_ctn_contributors_assembly_event_id_stock_movements_id_fk" FOREIGN KEY ("assembly_event_id") REFERENCES "public"."stock_movements"("id") ON DELETE restrict ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "kit_ctn_contributors_kit_ctn_idx" ON "kit_ctn_contributors" ("kit_ctn_id");
CREATE INDEX IF NOT EXISTS "kit_ctn_contributors_component_ctn_idx" ON "kit_ctn_contributors" ("component_ctn_id");
CREATE INDEX IF NOT EXISTS "kit_ctn_contributors_assembly_event_idx" ON "kit_ctn_contributors" ("assembly_event_id");
CREATE INDEX IF NOT EXISTS "kit_ctn_contributors_component_donor_idx" ON "kit_ctn_contributors" ("component_donor_id");

INSERT INTO "donors" ("name", "code", "type", "country", "notes")
VALUES
(
	'Blended Contributors',
	'BLENDED',
	'multilateral',
	NULL,
	'System-generated donor for kits assembled from multiple contributor CTNs. Contributing donors tracked per kit CTN.'
),
(
	'Legacy Stock (pre-WMS)',
	'LEGACY',
	'synthetic',
	NULL,
	'System-generated donor for stock introduced before WMS adoption at a facility.'
)
ON CONFLICT ("code") DO NOTHING;
