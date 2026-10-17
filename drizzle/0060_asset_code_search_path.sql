-- IVA-177: pin search_path on the asset code trigger function (Supabase advisor
-- "function_search_path_mutable"). The function only touches public objects (sites, assets,
-- nrcs_item_category_code); pg_advisory_xact_lock and format/lpad resolve via pg_catalog, which
-- is always searched first. Signature: public.nrcs_generate_asset_code() RETURNS trigger.
ALTER FUNCTION public.nrcs_generate_asset_code() SET search_path = public;
