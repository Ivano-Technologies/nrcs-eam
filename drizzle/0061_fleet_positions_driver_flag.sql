-- Fleet Wave 0 (IVA-168): position designations and the driver flag.
-- Positions are job titles mapped to users, separate from the app role. Fleet waves 1 to 5 use them to
-- target alerts, booking approval and the monthly report.
--   head_of_fleet, gm_assets_admin, sg: organisation-wide, so site_id is NULL.
--   branch_secretary: one branch, so site_id is required.
-- The driver flag lives in its own table (one row per flagged user) rather than a users column, so the
-- core users queries (sign-in, auth.me) don't depend on this migration having been applied.
-- RLS matches 0058: enabled with only the service_role_full_access policy. App access is in tRPC (admin only).

CREATE TABLE IF NOT EXISTS fleet_drivers (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  flagged_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS user_positions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position VARCHAR(32) NOT NULL,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  assigned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT user_positions_position_check
    CHECK (position IN ('head_of_fleet', 'branch_secretary', 'gm_assets_admin', 'sg')),
  CONSTRAINT user_positions_site_check
    CHECK ((position = 'branch_secretary') = (site_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS user_positions_user_position_site_uq
  ON user_positions (user_id, position, COALESCE(site_id, 0));
CREATE INDEX IF NOT EXISTS idx_user_positions_position_site
  ON user_positions (position, site_id);

ALTER TABLE "user_positions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "user_positions";
CREATE POLICY "service_role_full_access" ON "user_positions"
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE "fleet_drivers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "fleet_drivers";
CREATE POLICY "service_role_full_access" ON "fleet_drivers"
  TO service_role
  USING (true)
  WITH CHECK (true);
