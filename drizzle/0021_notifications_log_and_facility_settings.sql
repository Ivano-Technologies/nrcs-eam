CREATE TABLE IF NOT EXISTS "notifications_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "type" varchar(80) NOT NULL,
  "recipient" varchar(255) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "status" varchar(32) NOT NULL,
  "error" text,
  "sent_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "facility_notification_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "facility_id" integer NOT NULL,
  "notification_type" varchar(80) NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "updated_by" integer,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facility_notification_settings_facility_id_sites_id_fk'
  ) THEN
    ALTER TABLE "facility_notification_settings"
    ADD CONSTRAINT "facility_notification_settings_facility_id_sites_id_fk"
    FOREIGN KEY ("facility_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facility_notification_settings_updated_by_users_id_fk'
  ) THEN
    ALTER TABLE "facility_notification_settings"
    ADD CONSTRAINT "facility_notification_settings_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "facility_notification_settings_type_idx"
ON "facility_notification_settings" USING btree ("facility_id","notification_type");
