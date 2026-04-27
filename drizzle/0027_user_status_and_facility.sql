DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'field'
  ) THEN
    ALTER TYPE "public"."user_role" ADD VALUE 'field';
  END IF;
END
$$;
--> statement-breakpoint

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "status" varchar(16) DEFAULT 'active' NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_status_check"
      CHECK ("status" IN ('active', 'inactive', 'pending'));
  END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_siteId_sites_id_fk'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_siteId_sites_id_fk"
      FOREIGN KEY ("siteId") REFERENCES "public"."sites"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END
$$;
