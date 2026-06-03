DO $$ BEGIN
  CREATE TYPE async_job_status AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE async_job_type AS ENUM ('pdf_generate', 'email_send', 'import_finalize');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS async_jobs (
  id serial PRIMARY KEY,
  job_type async_job_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status async_job_status NOT NULL DEFAULT 'pending',
  run_after timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  last_error text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_async_jobs_pending_run
  ON async_jobs (status, run_after)
  WHERE status = 'pending';
