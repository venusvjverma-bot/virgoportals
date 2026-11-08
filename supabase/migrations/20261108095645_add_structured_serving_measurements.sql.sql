/*
# Structured drink serving measurements

1. Modified Tables
- `dish_serving_options`
  - Added `quantity` (numeric, nullable) — the numeric serving amount, e.g. 25.
  - Added `unit` (text, nullable) — measurement unit, restricted by CHECK to 'cl', 'ml' or 'oz'.
  - `label` stays NOT NULL and remains the canonical visitor-facing serving label (e.g. "25 cl").

2. Backfill
- Existing rows whose label unambiguously states a supported measurement
  ("25 cl", "330 ml", "12 oz", decimal commas like "1,5 cl") get quantity and
  unit populated. The label text itself is NOT changed.
- Ambiguous or unsupported labels ("Pint", "Glas", "Small", "0.5 L") keep their
  original label with quantity and unit left NULL for host review.
- Prices, ordering, active status and relationships are untouched.

3. Security
- No RLS or grant changes: the new nullable columns are covered by the existing
  table-level grants for anon, authenticated and service_role.

4. Important Notes
- No columns are dropped or renamed; the change is purely additive and safe.
- No unit conversion is performed anywhere.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dish_serving_options' AND column_name = 'quantity') THEN
    ALTER TABLE dish_serving_options ADD COLUMN quantity numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dish_serving_options' AND column_name = 'unit') THEN
    ALTER TABLE dish_serving_options ADD COLUMN unit text;
  END IF;
END $$;

ALTER TABLE dish_serving_options DROP CONSTRAINT IF EXISTS dish_serving_options_unit_allowed;
ALTER TABLE dish_serving_options ADD CONSTRAINT dish_serving_options_unit_allowed
  CHECK (unit IS NULL OR unit IN ('cl', 'ml', 'oz'));

-- Backfill only unambiguous "quantity + unit" labels. Label text is preserved.
UPDATE dish_serving_options
SET quantity = replace(m[1], ',', '.')::numeric,
    unit = lower(m[2])
FROM (
  SELECT id,
           regexp_match(label, '^\s*(\d+(?:[.,]\d+)?)\s*(cl|ml|oz)\s*\.?\s*$', 'i') AS m
  FROM dish_serving_options
  WHERE quantity IS NULL AND unit IS NULL
) parsed
WHERE dish_serving_options.id = parsed.id
  AND parsed.m IS NOT NULL;
