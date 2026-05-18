-- Sync user deletions between Supabase Auth (auth.users) and app profiles (public.users).
-- Apply in Supabase SQL Editor or: node scripts/apply-auth-triggers.mjs
--
-- When an auth user is deleted (dashboard, Auth API, or app trigger), remove public.users row.
-- When an app user is deleted (Admin → Users), remove auth.users row.

CREATE OR REPLACE FUNCTION sync_delete_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.users WHERE email = OLD.email;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_delete_auth_user();

CREATE OR REPLACE FUNCTION sync_delete_app_user()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM auth.users WHERE email = OLD.email;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_app_user_deleted ON public.users;
CREATE TRIGGER on_app_user_deleted
  AFTER DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_delete_app_user();
