CREATE OR REPLACE FUNCTION enforce_facility_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  parent_type TEXT;
  parent_depth INTEGER := 0;
BEGIN
  IF NEW."facilityType" = 'national_headquarters' AND NEW."parentFacilityId" IS NOT NULL THEN
    RAISE EXCEPTION 'National headquarters cannot have a parent facility';
  END IF;

  IF NEW."parentFacilityId" = NEW.id THEN
    RAISE EXCEPTION 'A facility cannot be its own parent';
  END IF;

  IF NEW."parentFacilityId" IS NOT NULL THEN
    SELECT "facilityType" INTO parent_type
    FROM sites
    WHERE id = NEW."parentFacilityId";

    IF parent_type IS NULL THEN
      RAISE EXCEPTION 'Parent facility % does not exist', NEW."parentFacilityId";
    END IF;

    IF NEW."facilityType" = 'branch' AND parent_type != 'national_headquarters' THEN
      RAISE EXCEPTION 'Branch parent must be national_headquarters, got %', parent_type;
    END IF;

    IF NEW."facilityType" IN ('division', 'warehouse', 'clinic')
      AND parent_type != 'branch'
    THEN
      RAISE EXCEPTION '% parent must be a branch, got %', NEW."facilityType", parent_type;
    END IF;

    IF NEW.id IS NOT NULL THEN
      IF EXISTS (
        WITH RECURSIVE ancestors AS (
          SELECT id, "parentFacilityId"
          FROM sites
          WHERE id = NEW."parentFacilityId"
          UNION ALL
          SELECT s.id, s."parentFacilityId"
          FROM sites s
          INNER JOIN ancestors a ON s.id = a."parentFacilityId"
        )
        SELECT 1
        FROM ancestors
        WHERE id = NEW.id
      ) THEN
        RAISE EXCEPTION 'Circular parent chain detected';
      END IF;
    END IF;

    SELECT COALESCE(MAX(depth), 0) INTO parent_depth
    FROM (
      WITH RECURSIVE ancestors AS (
        SELECT id, "parentFacilityId", 0 AS depth
        FROM sites
        WHERE id = NEW."parentFacilityId"
        UNION ALL
        SELECT s.id, s."parentFacilityId", a.depth + 1
        FROM sites s
        INNER JOIN ancestors a ON s.id = a."parentFacilityId"
      )
      SELECT depth FROM ancestors
    ) depth_rows;

    IF parent_depth + 1 > 2 THEN
      RAISE EXCEPTION 'Max hierarchy depth is 2 levels (NHQ → Branch → Child)';
    END IF;
  ELSE
    IF NEW."facilityType" IN ('branch', 'division', 'warehouse', 'clinic') THEN
      RAISE EXCEPTION '% requires a parent facility', NEW."facilityType";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS facility_hierarchy_check ON sites;
--> statement-breakpoint

CREATE TRIGGER facility_hierarchy_check
  BEFORE INSERT OR UPDATE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION enforce_facility_hierarchy();

