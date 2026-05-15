ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password_on_login" boolean DEFAULT false NOT NULL;
