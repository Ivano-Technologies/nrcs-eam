-- Revoke public execute grants on SECURITY DEFINER trigger functions.
-- These functions run exclusively as triggers and should not be callable
-- by anon or authenticated roles via PostgREST (/rest/v1/rpc/).

REVOKE EXECUTE ON FUNCTION public.enforce_facility_hierarchy() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_delete_auth_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_delete_app_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
