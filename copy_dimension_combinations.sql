-- Copy Dimension Combinations local -> production.
-- Dimension references resolved by NAME at runtime (parenthetical suffixes
-- stripped: 'Small (Converse, Vans, Crocs)' -> 'Small'), so mismatched cuids
-- between environments do not matter. Idempotent (ON CONFLICT DO NOTHING).
BEGIN;

-- Guard: abort the whole transaction if production is missing any dimension
-- these combinations reference, so we never commit a partial/broken copy.
DO $guard$
DECLARE missing text;
BEGIN
  SELECT string_agg(v.n, ', ') INTO missing
  FROM (VALUES ('Extra Large'), ('Large'), ('Medium'), ('Small')) AS v(n)
  WHERE NOT EXISTS (SELECT 1 FROM "Dimension" d WHERE d.name = v.n);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Aborting: production is missing dimension(s): %', missing;
  END IF;
END
$guard$;

WITH data(name, weight, is_active, box_name) AS (
  VALUES
  ('Large × 1 + Medium × 1', 5, TRUE, 'Extra Large'),
  ('Large × 1 + Medium × 1 + Small × 1', 5, TRUE, 'Extra Large'),
  ('Large × 1 + Medium × 1 + Small × 2', 5, TRUE, 'Extra Large'),
  ('Large × 1 + Medium × 2', 5, TRUE, 'Extra Large'),
  ('Large × 1 + Medium × 2 + Small × 1', 5, TRUE, 'Extra Large'),
  ('Large × 1 + Medium × 3', 5, TRUE, 'Extra Large'),
  ('Large × 1 + Small × 1', 5, TRUE, 'Extra Large'),
  ('Large × 1 + Small × 2', 5, TRUE, 'Extra Large'),
  ('Large × 1 + Small × 3', 5, TRUE, 'Extra Large'),
  ('Large × 2', 5, TRUE, 'Extra Large'),
  ('Large × 2 + Medium × 1', 5, TRUE, 'Extra Large'),
  ('Large × 2 + Medium × 1 + Small × 1', 5, TRUE, 'Extra Large'),
  ('Large × 2 + Medium × 2', 5, TRUE, 'Extra Large'),
  ('Large × 2 + Small × 1', 5, TRUE, 'Extra Large'),
  ('Large × 2 + Small × 2', 5, TRUE, 'Extra Large'),
  ('Large × 3', 5, TRUE, 'Extra Large'),
  ('Large × 3 + Medium × 1', 5, TRUE, 'Extra Large'),
  ('Large × 3 + Small × 1', 5, TRUE, 'Extra Large'),
  ('Large × 4', 5, TRUE, 'Extra Large'),
  ('Medium × 1 + Small × 1', 2, TRUE, 'Large'),
  ('Medium × 1 + Small × 2', 2, TRUE, 'Large'),
  ('Medium × 1 + Small × 3', 5, TRUE, 'Extra Large'),
  ('Medium × 2', 2, TRUE, 'Large'),
  ('Medium × 2 + Small × 1', 5, TRUE, 'Extra Large'),
  ('Medium × 2 + Small × 2', 5, TRUE, 'Extra Large'),
  ('Medium × 3', 5, TRUE, 'Extra Large'),
  ('Medium × 3 + Small × 1', 5, TRUE, 'Extra Large'),
  ('Medium × 4', 5, TRUE, 'Extra Large'),
  ('Small × 2', 1, TRUE, 'Medium'),
  ('Small × 3', 2, TRUE, 'Large'),
  ('Small × 4', 2, TRUE, 'Large')
)
INSERT INTO "DimensionCombination" (id, name, weight, "boxDimensionId", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, d.name, d.weight, b.id, d.is_active, now(), now()
FROM data d
JOIN "Dimension" b ON b.name = d.box_name
ON CONFLICT (name) DO NOTHING;

WITH items(combo_name, dim_name, quantity) AS (
  VALUES
  ('Large × 1 + Medium × 1', 'Large', 1),
  ('Large × 1 + Medium × 1', 'Medium', 1),
  ('Large × 1 + Medium × 1 + Small × 1', 'Large', 1),
  ('Large × 1 + Medium × 1 + Small × 1', 'Medium', 1),
  ('Large × 1 + Medium × 1 + Small × 1', 'Small', 1),
  ('Large × 1 + Medium × 1 + Small × 2', 'Large', 1),
  ('Large × 1 + Medium × 1 + Small × 2', 'Medium', 1),
  ('Large × 1 + Medium × 1 + Small × 2', 'Small', 2),
  ('Large × 1 + Medium × 2', 'Large', 1),
  ('Large × 1 + Medium × 2', 'Medium', 2),
  ('Large × 1 + Medium × 2 + Small × 1', 'Large', 1),
  ('Large × 1 + Medium × 2 + Small × 1', 'Medium', 2),
  ('Large × 1 + Medium × 2 + Small × 1', 'Small', 1),
  ('Large × 1 + Medium × 3', 'Large', 1),
  ('Large × 1 + Medium × 3', 'Medium', 3),
  ('Large × 1 + Small × 1', 'Large', 1),
  ('Large × 1 + Small × 1', 'Small', 1),
  ('Large × 1 + Small × 2', 'Large', 1),
  ('Large × 1 + Small × 2', 'Small', 2),
  ('Large × 1 + Small × 3', 'Large', 1),
  ('Large × 1 + Small × 3', 'Small', 3),
  ('Large × 2', 'Large', 2),
  ('Large × 2 + Medium × 1', 'Large', 2),
  ('Large × 2 + Medium × 1', 'Medium', 1),
  ('Large × 2 + Medium × 1 + Small × 1', 'Large', 2),
  ('Large × 2 + Medium × 1 + Small × 1', 'Medium', 1),
  ('Large × 2 + Medium × 1 + Small × 1', 'Small', 1),
  ('Large × 2 + Medium × 2', 'Large', 2),
  ('Large × 2 + Medium × 2', 'Medium', 2),
  ('Large × 2 + Small × 1', 'Large', 2),
  ('Large × 2 + Small × 1', 'Small', 1),
  ('Large × 2 + Small × 2', 'Large', 2),
  ('Large × 2 + Small × 2', 'Small', 2),
  ('Large × 3', 'Large', 3),
  ('Large × 3 + Medium × 1', 'Large', 3),
  ('Large × 3 + Medium × 1', 'Medium', 1),
  ('Large × 3 + Small × 1', 'Large', 3),
  ('Large × 3 + Small × 1', 'Small', 1),
  ('Large × 4', 'Large', 4),
  ('Medium × 1 + Small × 1', 'Medium', 1),
  ('Medium × 1 + Small × 1', 'Small', 1),
  ('Medium × 1 + Small × 2', 'Medium', 1),
  ('Medium × 1 + Small × 2', 'Small', 2),
  ('Medium × 1 + Small × 3', 'Medium', 1),
  ('Medium × 1 + Small × 3', 'Small', 3),
  ('Medium × 2', 'Medium', 2),
  ('Medium × 2 + Small × 1', 'Medium', 2),
  ('Medium × 2 + Small × 1', 'Small', 1),
  ('Medium × 2 + Small × 2', 'Medium', 2),
  ('Medium × 2 + Small × 2', 'Small', 2),
  ('Medium × 3', 'Medium', 3),
  ('Medium × 3 + Small × 1', 'Medium', 3),
  ('Medium × 3 + Small × 1', 'Small', 1),
  ('Medium × 4', 'Medium', 4),
  ('Small × 2', 'Small', 2),
  ('Small × 3', 'Small', 3),
  ('Small × 4', 'Small', 4)
)
INSERT INTO "DimensionCombinationItem" (id, "combinationId", "dimensionId", quantity)
SELECT gen_random_uuid()::text, c.id, dm.id, i.quantity
FROM items i
JOIN "DimensionCombination" c ON c.name = i.combo_name
JOIN "Dimension" dm ON dm.name = i.dim_name
ON CONFLICT ("combinationId", "dimensionId") DO NOTHING;

COMMIT;

-- Verify (should print 31 combos / 57 items if prod started empty):
SELECT (SELECT count(*) FROM "DimensionCombination") AS combos,
       (SELECT count(*) FROM "DimensionCombinationItem") AS items;
