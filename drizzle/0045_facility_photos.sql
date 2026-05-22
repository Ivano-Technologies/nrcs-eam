CREATE TABLE IF NOT EXISTS facility_photos (
  id SERIAL PRIMARY KEY,
  "siteId" INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  "photoUrl" TEXT NOT NULL,
  "photoKey" TEXT NOT NULL,
  "caption" TEXT,
  "uploadedBy" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_facility_photos_site_id
  ON facility_photos("siteId");
