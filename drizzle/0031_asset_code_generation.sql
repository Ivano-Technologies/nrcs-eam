CREATE OR REPLACE FUNCTION public.nrcs_item_category_code(category_name text)
RETURNS varchar
LANGUAGE plpgsql
AS $$
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
$$;

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

DROP TRIGGER IF EXISTS trg_nrcs_generate_asset_code ON assets;
CREATE TRIGGER trg_nrcs_generate_asset_code
BEFORE INSERT OR UPDATE ON assets
FOR EACH ROW
EXECUTE FUNCTION public.nrcs_generate_asset_code();
