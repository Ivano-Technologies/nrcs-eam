-- Phase 4d: Repoint distributions.waybill_id from inventory_documents to waybills

ALTER TABLE "distributions" DROP CONSTRAINT IF EXISTS "distributions_waybill_id_inventory_documents_id_fk";
--> statement-breakpoint
UPDATE "distributions" d
SET "waybill_id" = w.id
FROM "inventory_documents" idoc
INNER JOIN "waybills" w ON w.wb_number = idoc.document_number
WHERE d.waybill_id = idoc.id
  AND idoc.document_type = 'waybill';
--> statement-breakpoint
UPDATE "distributions" d
SET "waybill_id" = NULL
FROM "inventory_documents" idoc
WHERE d.waybill_id = idoc.id
  AND idoc.document_type = 'waybill'
  AND NOT EXISTS (SELECT 1 FROM "waybills" w WHERE w.wb_number = idoc.document_number);
--> statement-breakpoint
UPDATE "distributions" d
SET "waybill_id" = NULL
WHERE d.waybill_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "waybills" w WHERE w.id = d.waybill_id);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "distributions"
    ADD CONSTRAINT "distributions_waybill_id_waybills_id_fk"
    FOREIGN KEY ("waybill_id") REFERENCES "public"."waybills"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
