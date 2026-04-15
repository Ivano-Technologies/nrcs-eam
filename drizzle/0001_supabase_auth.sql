DROP TABLE IF EXISTS "auth_tokens" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."auth_token_type";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_user_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_auth_user_id_unique" ON "users" ("auth_user_id");
