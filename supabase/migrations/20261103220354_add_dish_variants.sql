/*
# Add dish variants (selectable options with an additional price)

## Plain-English summary
Adds a separate list of variants for Food and Drink dishes. A variant is one choice
under a menu item (for example Pad Thai with Chicken, Beef or Prawns). Each variant
has its own extra price on top of the dish's base price. The base price stays on the
dish. Serving sizes (dish_serving_options) are not changed.

## New tables
- `dish_variants`
  - `id` (uuid, primary key)
  - `dish_id` (uuid, FK to dishes, ON DELETE CASCADE)
  - `name` (text, NOT NULL, e.g. "Beef")
  - `additional_price` (text, NOT NULL, default '0' — extra cost in the same text format as dishes.price, e.g. "15 SEK". Zero is allowed.)
  - `sort_order` (integer, NOT NULL, default 0)
  - `is_active` (boolean, NOT NULL, default true)
  - `created_at`, `updated_at` (timestamptz)

## Modified tables
- `order_items`
  - `variant_id` (uuid, nullable, FK to dish_variants ON DELETE SET NULL)
  - `variant_name` (text, nullable — snapshot so the host still sees the chosen variant if it is later edited or removed)
  - `variant_additional_minor` (integer, nullable — snapshot of the extra cost applied to that order line)

## Security (RLS + grants)
- `dish_variants`: RLS enabled.
  - SELECT: anon and authenticated can read active variants; the owning host can read all their variants.
  - INSERT/UPDATE/DELETE: authenticated hosts only, scoped to dishes of their own restaurant.
  - service_role has full access for edge functions.
- `order_items` new columns use the table's existing grants.

## Important notes
1. Existing rows are untouched. Dishes without variants behave exactly as before.
2. Final price stored on order_items.price_minor remains the source of truth for totals.
3. Variant prices are never trusted from the client; the server reads them from this table.
*/

CREATE TABLE IF NOT EXISTS dish_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  name text NOT NULL,
  additional_price text NOT NULL DEFAULT '0',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dish_variants_dish_id_idx ON dish_variants(dish_id);

ALTER TABLE dish_variants ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON dish_variants TO service_role;
GRANT SELECT ON dish_variants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON dish_variants TO authenticated;

DROP POLICY IF EXISTS "read_dish_variants" ON dish_variants;
CREATE POLICY "read_dish_variants"
ON dish_variants FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  OR EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_variants.dish_id
    AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "insert_own_dish_variants" ON dish_variants;
CREATE POLICY "insert_own_dish_variants"
ON dish_variants FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_variants.dish_id
    AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "update_own_dish_variants" ON dish_variants;
CREATE POLICY "update_own_dish_variants"
ON dish_variants FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_variants.dish_id
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_variants.dish_id
    AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "delete_own_dish_variants" ON dish_variants;
CREATE POLICY "delete_own_dish_variants"
ON dish_variants FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_variants.dish_id
    AND r.owner_id = auth.uid()
  )
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'variant_id') THEN
    ALTER TABLE order_items ADD COLUMN variant_id uuid REFERENCES dish_variants(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'variant_name') THEN
    ALTER TABLE order_items ADD COLUMN variant_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'variant_additional_minor') THEN
    ALTER TABLE order_items ADD COLUMN variant_additional_minor integer;
  END IF;
END $$;
