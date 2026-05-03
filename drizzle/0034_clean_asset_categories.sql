-- Align assetCategories with official NRCS register (8 canonical names only).

INSERT INTO "assetCategories" ("name", "description")
SELECT v.name, NULL
FROM (
  VALUES
    ('Computer'),
    ('Furniture & Fixtures'),
    ('Generator'),
    ('Land'),
    ('Land & Building'),
    ('Medical Equipment'),
    ('Office Equipment'),
    ('Vehicle')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM "assetCategories" ac WHERE ac.name = v.name);

-- Remap assets from legacy / non-official category names
UPDATE "assets" a
SET "categoryId" = (SELECT c.id FROM "assetCategories" c WHERE c.name = 'Computer' ORDER BY c.id ASC LIMIT 1)
WHERE "categoryId" IN (SELECT id FROM "assetCategories" WHERE name IN ('Computer Equipment', 'IT Equipment', 'Software'));

UPDATE "assets" a
SET "categoryId" = (SELECT c.id FROM "assetCategories" c WHERE c.name = 'Office Equipment' ORDER BY c.id ASC LIMIT 1)
WHERE "categoryId" IN (
  SELECT id FROM "assetCategories"
  WHERE name IN (
    'Communication Equipment',
    'Communications Equipment',
    'Other Equipment',
    'Visibility'
  )
);

UPDATE "assets" a
SET "categoryId" = (SELECT c.id FROM "assetCategories" c WHERE c.name = 'Generator' ORDER BY c.id ASC LIMIT 1)
WHERE "categoryId" IN (SELECT id FROM "assetCategories" WHERE name IN ('Machinery', 'Generators', 'Power Source'));

UPDATE "assets" a
SET "categoryId" = (SELECT c.id FROM "assetCategories" c WHERE c.name = 'Land & Building' ORDER BY c.id ASC LIMIT 1)
WHERE "categoryId" IN (SELECT id FROM "assetCategories" WHERE name IN ('Building', 'Buildings'));

UPDATE "assets" a
SET "categoryId" = (SELECT c.id FROM "assetCategories" c WHERE c.name = 'Furniture & Fixtures' ORDER BY c.id ASC LIMIT 1)
WHERE "categoryId" IN (SELECT id FROM "assetCategories" WHERE name = 'Furniture');

UPDATE "assets" a
SET "categoryId" = (SELECT c.id FROM "assetCategories" c WHERE c.name = 'Vehicle' ORDER BY c.id ASC LIMIT 1)
WHERE "categoryId" IN (SELECT id FROM "assetCategories" WHERE name = 'Vehicles');

UPDATE "assets" a
SET "categoryId" = (SELECT c.id FROM "assetCategories" c WHERE c.name = 'Office Equipment' ORDER BY c.id ASC LIMIT 1)
WHERE "categoryId" IN (
  SELECT id FROM "assetCategories"
  WHERE name NOT IN (
    'Computer', 'Furniture & Fixtures', 'Generator', 'Land', 'Land & Building',
    'Medical Equipment', 'Office Equipment', 'Vehicle'
  )
);

UPDATE "workOrderTemplates" w
SET "categoryId" = (SELECT c.id FROM "assetCategories" c WHERE c.name = 'Office Equipment' ORDER BY c.id ASC LIMIT 1)
WHERE "categoryId" IS NOT NULL
  AND "categoryId" IN (
    SELECT id FROM "assetCategories"
    WHERE name NOT IN (
      'Computer', 'Furniture & Fixtures', 'Generator', 'Land', 'Land & Building',
      'Medical Equipment', 'Office Equipment', 'Vehicle'
    )
  );

-- Point references at one row per canonical name (lowest id)
UPDATE "assets" a
SET "categoryId" = k.keep_id
FROM (
  SELECT name, MIN(id) AS keep_id
  FROM "assetCategories"
  WHERE name IN (
    'Computer', 'Furniture & Fixtures', 'Generator', 'Land', 'Land & Building',
    'Medical Equipment', 'Office Equipment', 'Vehicle'
  )
  GROUP BY name
) k
JOIN "assetCategories" dup ON dup.name = k.name AND dup.id <> k.keep_id
WHERE a."categoryId" = dup.id;

UPDATE "workOrderTemplates" w
SET "categoryId" = k.keep_id
FROM (
  SELECT name, MIN(id) AS keep_id
  FROM "assetCategories"
  WHERE name IN (
    'Computer', 'Furniture & Fixtures', 'Generator', 'Land', 'Land & Building',
    'Medical Equipment', 'Office Equipment', 'Vehicle'
  )
  GROUP BY name
) k
JOIN "assetCategories" dup ON dup.name = k.name AND dup.id <> k.keep_id
WHERE w."categoryId" = dup.id;

DELETE FROM "assetCategories" d
USING "assetCategories" keeper
WHERE keeper.name = d.name
  AND keeper.id < d.id
  AND d.name IN (
    'Computer', 'Furniture & Fixtures', 'Generator', 'Land', 'Land & Building',
    'Medical Equipment', 'Office Equipment', 'Vehicle'
  );

DELETE FROM "assetCategories"
WHERE name NOT IN (
  'Computer', 'Furniture & Fixtures', 'Generator', 'Land', 'Land & Building',
  'Medical Equipment', 'Office Equipment', 'Vehicle'
);

INSERT INTO "assetCategories" ("name", "description")
SELECT v.name, NULL
FROM (
  VALUES
    ('Computer'),
    ('Furniture & Fixtures'),
    ('Generator'),
    ('Land'),
    ('Land & Building'),
    ('Medical Equipment'),
    ('Office Equipment'),
    ('Vehicle')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM "assetCategories" ac WHERE ac.name = v.name);
