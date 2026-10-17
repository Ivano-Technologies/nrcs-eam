-- IVA-158: make asset_code / assetTag generation race-safe.
-- Before this, two concurrent inserts for the same branch_code + item_category_code could both read the
-- same max(asset_num) and collide on assets_assetTag_unique. Only the function body changes; the trigger
-- itself (trg_nrcs_generate_asset_code) is untouched. Existing rows and numbering are unchanged.
CREATE OR REPLACE FUNCTION public.nrcs_generate_asset_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_branch_code varchar;
  resolved_category_code varchar(2);
  next_num integer;
BEGIN
  resolved_branch_code := nullif(NEW.branch_code, '');

  IF resolved_branch_code IS NULL OR resolved_branch_code = '' THEN
    SELECT s."code" INTO resolved_branch_code
    FROM sites s
    WHERE s.id = NEW."siteId"
    LIMIT 1;
  END IF;

  NEW.branch_code := resolved_branch_code;
  NEW.item_category_code := coalesce(
    nullif(NEW.item_category_code, ''),
    public.nrcs_item_category_code(NEW.item_category)
  );
  resolved_category_code := NEW.item_category_code;

  IF TG_OP = 'UPDATE' AND OLD.asset_code IS NOT NULL AND OLD.asset_code <> '' THEN
    IF NEW.asset_code IS DISTINCT FROM OLD.asset_code
       OR NEW.branch_code IS DISTINCT FROM OLD.branch_code
       OR NEW.item_category_code IS DISTINCT FROM OLD.item_category_code
       OR NEW.asset_num IS DISTINCT FROM OLD.asset_num THEN
      RAISE EXCEPTION 'asset_code is immutable once generated';
    END IF;
    RETURN NEW;
  END IF;

  IF resolved_branch_code IS NULL OR resolved_branch_code = '' THEN
    RAISE EXCEPTION 'branch_code is required to generate asset_code';
  END IF;
  IF resolved_category_code IS NULL OR resolved_category_code = '' THEN
    RAISE EXCEPTION 'item_category_code is required to generate asset_code';
  END IF;

  IF NEW.asset_num IS NULL OR NEW.asset_num <= 0 THEN
    -- IVA-158: serialise numbering per branch + category. The transaction-scoped advisory lock is held
    -- until commit, so a concurrent insert for the same pair waits, then its max() (a fresh statement
    -- snapshot under READ COMMITTED) sees the committed row and takes the next number.
    PERFORM pg_advisory_xact_lock(
      hashtext('nrcs_asset_code'),
      hashtext(resolved_branch_code || ':' || resolved_category_code)
    );
    SELECT coalesce(max(a.asset_num), 0) + 1
      INTO next_num
    FROM assets a
    WHERE a.branch_code = resolved_branch_code
      AND a.item_category_code = resolved_category_code;
    NEW.asset_num := next_num;
  END IF;

  IF NEW.asset_code IS NULL OR NEW.asset_code = '' THEN
    NEW.asset_code := format('NRCS_%s%s%s', resolved_branch_code, resolved_category_code, lpad(NEW.asset_num::text, 4, '0'));
  END IF;

  NEW."assetTag" := NEW.asset_code;
  RETURN NEW;
END;
$$;
