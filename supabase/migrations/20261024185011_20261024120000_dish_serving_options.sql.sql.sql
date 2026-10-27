/*
# Dish Serving Options — Multiple Serving Sizes per Drink

## Purpose
Allows a host to configure multiple serving-size options for a single dish,
each with its own label (e.g. "2 cl", "4 cl") and price (e.g. "45 SEK").
Visitors select one serving size from a radio-button list in the enlarged
dish card. The selected option's price is used for basket, checkout, and
order persistence.

## New Tables
- `dish_serving_options`
  - `id` (uuid, primary key)
  - `dish_id` (uuid, FK to dishes, ON DELETE CASCADE)
  - `label` (text, NOT NULL — e.g. "2 cl", "4 cl")
  - `price` (text, NOT NULL — same free-text format as dishes.price, e.g. "45 SEK")
  - `sort_order` (integer, NOT NULL, default 0 — host-configured display order)
  - `is_active` (boolean, NOT NULL, default true — soft-deactivation without losing historical order references)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## Modified Tables
- `order_items`
  - Added `serving_option_id` (uuid, nullable, FK to dish_serving_options ON DELETE SET NULL)
  - Added `serving_label` (text, nullable — denormalized so the host order view shows the size even if the option is later deleted)

## Security (RLS + Grants)
- `dish_serving_options`: RLS enabled.
  - SELECT: `anon, authenticated` can read active options (visitors need to see them in the card; hosts need to see all their options). Hosts see all their own options via ownership check through the parent dish's restaurant.
  - INSERT/UPDATE/DELETE: `authenticated` only, scoped to the host's own restaurant through the dish → restaurant ownership chain.
  - `service_role` granted all verbs (edge functions use service key).
- `order_items`: existing grants extended to cover the new nullable columns (no new grant needed — the table-level grant already covers all columns).

## Backward Compatibility
- `dish_serving_options` starts empty. Dishes with zero options continue to use `dishes.price` and `dishes.serving` as before.
- `order_items.serving_option_id` and `serving_label` are nullable. All existing order items have NULL values and remain valid.
- No existing columns are dropped or renamed. No data migration required.

## Important Notes
1. The `price` column on `dish_serving_options` uses the same text format as `dishes.price` so the existing `parsePriceMinor` logic in the edge functions can be reused without modification.
2. `ON DELETE SET NULL` on `order_items.serving_option_id` preserves historical order data when a serving option is deleted. The `serving_label` text column ensures the label is still visible in the host's order detail view.
3. `ON DELETE CASCADE` on `dish_serving_options.dish_id` ensures options are removed when a dish is deleted.
4. `is_active` lets hosts retire a serving size without deleting it — existing orders keep their FK reference valid.
*/

-- ─── Create dish_serving_options table ───
CREATE TABLE IF NOT EXISTS dish_serving_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  label text NOT NULL,
  price text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dish_serving_options_dish_id_idx ON dish_serving_options(dish_id);
CREATE INDEX IF NOT EXISTS dish_serving_options_dish_id_active_idx ON dish_serving_options(dish_id) WHERE is_active = true;

ALTER TABLE dish_serving_options ENABLE ROW LEVEL SECURITY;

-- service_role (edge functions) needs full access
GRANT SELECT, INSERT, UPDATE, DELETE ON dish_serving_options TO service_role;

-- Visitors (anon) need to read active options; authenticated hosts need to read all their options
GRANT SELECT ON dish_serving_options TO anon, authenticated;
-- Hosts need write access
GRANT INSERT, UPDATE, DELETE ON dish_serving_options TO authenticated;

-- SELECT: anon can read active options; authenticated hosts can read all their own options
DROP POLICY IF EXISTS "read_serving_options" ON dish_serving_options;
CREATE POLICY "read_serving_options"
ON dish_serving_options FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  OR EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_serving_options.dish_id
    AND r.owner_id = auth.uid()
  )
);

-- INSERT: host can insert options for dishes they own
DROP POLICY IF EXISTS "insert_own_serving_options" ON dish_serving_options;
CREATE POLICY "insert_own_serving_options"
ON dish_serving_options FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_serving_options.dish_id
    AND r.owner_id = auth.uid()
  )
);

-- UPDATE: host can update options for dishes they own
DROP POLICY IF EXISTS "update_own_serving_options" ON dish_serving_options;
CREATE POLICY "update_own_serving_options"
ON dish_serving_options FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_serving_options.dish_id
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_serving_options.dish_id
    AND r.owner_id = auth.uid()
  )
);

-- DELETE: host can delete options for dishes they own
DROP POLICY IF EXISTS "delete_own_serving_options" ON dish_serving_options;
CREATE POLICY "delete_own_serving_options"
ON dish_serving_options FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_serving_options.dish_id
    AND r.owner_id = auth.uid()
  )
);

-- ─── Add serving option columns to order_items ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'serving_option_id') THEN
    ALTER TABLE order_items ADD COLUMN serving_option_id uuid REFERENCES dish_serving_options(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'serving_label') THEN
    ALTER TABLE order_items ADD COLUMN serving_label text;
  END IF;
END $$;
