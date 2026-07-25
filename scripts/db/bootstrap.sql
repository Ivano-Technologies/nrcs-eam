-- scripts/db/bootstrap.sql
-- Safe, idempotent prerequisites for vanilla Postgres (CI / fresh local DBs).
--
-- SAFETY: Every CREATE FUNCTION is existence-guarded (pg_proc + pg_namespace).
-- Never CREATE OR REPLACE — accidental runs against production / Supabase must
-- leave existing function bodies untouched. Roles use duplicate_object catch.
-- Safe to run twice; CI does exactly that to prove idempotency.

-- ---------------------------------------------------------------------------
-- Roles expected by historical migrations / RLS policies that reference
-- Supabase role names. Vanilla Postgres has none of these by default.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- pgcrypto: used by migrations that call gen_random_uuid() / crypt helpers.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- nrcs_item_category_code: migration 0030 references this before 0031 creates
-- it. Body MUST match 0031 verbatim (real category mapping, not a NULL stub).
-- Existence-guarded so a second bootstrap (or prod accident) does not replace
-- the post-0031 definition.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'nrcs_item_category_code'
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION public.nrcs_item_category_code(category_name text)
      RETURNS varchar
      LANGUAGE plpgsql
      AS $fn$
      BEGIN
        RETURN CASE trim(coalesce(category_name, ''))
          WHEN 'Computer' THEN 'CO'
          WHEN 'Furniture & Fixtures' THEN 'FF'
          WHEN 'Generator' THEN 'GE'
          WHEN 'Land' THEN 'LA'
          WHEN 'Land & Building' THEN 'LB'
          WHEN 'Medical Equipment' THEN 'ME'
          WHEN 'Office Equipment' THEN 'OE'
          WHEN 'Vehicle' THEN 'VE'
          ELSE NULL
        END;
      END;
      $fn$;
    $create$;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Empty stubs for Supabase-only helpers revoked in migration 0041 but never
-- created by drizzle SQL. Existence-guarded only — never replace real bodies
-- if someone later installs them from scripts/db/supabase-only/.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'sync_delete_auth_user'
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION public.sync_delete_auth_user()
      RETURNS void
      LANGUAGE plpgsql
      AS $fn$ BEGIN END; $fn$;
    $create$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'sync_delete_app_user'
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION public.sync_delete_app_user()
      RETURNS void
      LANGUAGE plpgsql
      AS $fn$ BEGIN END; $fn$;
    $create$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION public.rls_auto_enable()
      RETURNS void
      LANGUAGE plpgsql
      AS $fn$ BEGIN END; $fn$;
    $create$;
  END IF;
END
$$;
