ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "depreciated_value_manual_override" boolean DEFAULT false NOT NULL;
