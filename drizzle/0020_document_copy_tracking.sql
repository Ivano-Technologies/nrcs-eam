ALTER TABLE "goods_received_notes"
ADD COLUMN IF NOT EXISTS "copies_printed" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "inventory_documents"
ADD COLUMN IF NOT EXISTS "copies_printed" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "waybills"
ADD COLUMN IF NOT EXISTS "copies_printed" jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "document_print_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "document_type" varchar(50) NOT NULL,
  "document_id" integer NOT NULL,
  "copy_type" varchar(20),
  "printed_by" integer,
  "printed_at" timestamp DEFAULT now() NOT NULL,
  "is_reprint" boolean DEFAULT false NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_print_log_printed_by_users_id_fk'
  ) THEN
    ALTER TABLE "document_print_log"
    ADD CONSTRAINT "document_print_log_printed_by_users_id_fk"
    FOREIGN KEY ("printed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "document_print_log_doc_idx" ON "document_print_log" USING btree ("document_type","document_id");
