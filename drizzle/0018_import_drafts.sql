CREATE TABLE IF NOT EXISTS inventory_import_drafts (
  id SERIAL PRIMARY KEY,
  source VARCHAR(20) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255),
  row_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  validation_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  rows_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inv_import_drafts_status_idx
  ON inventory_import_drafts(status, validation_status, uploaded_at DESC);

