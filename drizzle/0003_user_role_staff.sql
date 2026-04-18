-- Replace legacy `technician` with `staff` and normalize enum order: user, staff, manager, admin

CREATE TYPE "user_role_new" AS ENUM ('user', 'staff', 'manager', 'admin');

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "users" ALTER COLUMN "role" TYPE "user_role_new" USING (
  CASE "users"."role"::text
    WHEN 'technician' THEN 'staff'::"user_role_new"
    WHEN 'admin' THEN 'admin'::"user_role_new"
    WHEN 'manager' THEN 'manager'::"user_role_new"
    WHEN 'user' THEN 'user'::"user_role_new"
    ELSE 'user'::"user_role_new"
  END
);

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::"user_role_new";

DROP TYPE "public"."user_role";

ALTER TYPE "user_role_new" RENAME TO "user_role";
