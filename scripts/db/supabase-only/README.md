# Supabase-only database objects

Some helpers exist only on the hosted Supabase project (auth sync triggers, RLS
auto-enable, etc.). Drizzle migrations reference or revoke them but do not ship
their full bodies. Vanilla Postgres (CI / local) gets **empty, existence-guarded
stubs** from `scripts/db/bootstrap.sql` so migrations can run.

## Export real function bodies (Kezie)

When you need the production definitions for local parity or disaster recovery,
run this against the Supabase SQL editor (or `psql` with the project connection)
and save the result as `functions.sql` in this folder:

```sql
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'sync_delete_auth_user',
    'sync_delete_app_user',
    'rls_auto_enable',
    'nrcs_item_category_code'
  )
ORDER BY p.proname;
```

Paste each `definition` into `functions.sql` (or keep the query result as a
reference dump). Do **not** invent bodies — only copy from Supabase.

## Placeholder

`functions.sql` is intentionally empty / absent until an export is checked in.
Bootstrap stubs remain the CI source of truth for empty Postgres.
