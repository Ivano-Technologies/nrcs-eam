-- IVA-179: pin search_path on the two remaining functions the Supabase advisor flags
-- ("function_search_path_mutable"), following IVA-177 (0060).
-- nrcs_item_category_code(text) only uses built-ins (trim, coalesce), which resolve via pg_catalog.
-- enforce_facility_hierarchy() (the sites trigger; SECURITY DEFINER on prod) only touches public.sites.
-- Idempotent: setting the same value again is a no-op.
ALTER FUNCTION public.nrcs_item_category_code(text) SET search_path = public;
--> statement-breakpoint
ALTER FUNCTION public.enforce_facility_hierarchy() SET search_path = public;
--> statement-breakpoint
-- IVA-179 hardening: fleet_drivers and user_positions (created in 0061) are service-role only. The app reaches
-- them through the server with the service role; anon and authenticated (PostgREST) get no table privileges.
-- Idempotent: revoking privileges that are already gone is a no-op. 0061 runs first, so both tables exist.
REVOKE ALL ON public.fleet_drivers, public.user_positions FROM anon, authenticated;
