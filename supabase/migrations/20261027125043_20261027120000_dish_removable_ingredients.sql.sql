/*
# Dish Removable Ingredients — Per-Dish Customisable Removals

## Purpose
Allows a host to configure a list of ingredients that visitors can choose to
remove from a dish before adding it to their basket. The visitor selects which
removals to apply; the selected removals are persisted with the order as
preparation instructions for the kitchen. This feature is host-managed only —
no AI suggestions.

## New Tables
- `dish_removable_ingredients`
  - `id` (uuid, primary key)
  - `dish_id` (uuid, FK to dishes, ON DELETE CASCADE)
  - `label` (text, NOT NULL — e.g. "Onion", "Coriander")
  - `sort_order` (integer, NOT NULL, default 0 — host-configured display order)
  - `is_active` (boolean, NOT NULL, default true — soft-deactivation without losing references)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## Modified Tables
- `order_items`
  - Added `removed_ingredients` (text, NOT NULL, default '' — denormalised comma-separated
    labels, e.g. "no onion, no coriander", so the host order view shows removals even if
    the ingredient row is later deleted)

## Security (RLS + Grants)
- `dish_removable_ingredients`: RLS enabled.
  - SELECT: `anon, authenticated` can read active ingredients (visitors need to see them
    in the dish card; hosts see all their own via ownership check through dish → restaurant).
  - INSERT/UPDATE/DELETE: `authenticated` only, scoped to the host's own restaurant through
    the dish → restaurant ownership chain.
  - `service_role` granted all verbs (edge functions use service key).
- `order_items`: existing grants already cover all columns; the new `removed_ingredients`
  column is accessible to the same roles.

## Backward Compatibility
- `dish_removable_ingredients` starts empty. Dishes with zero removable ingredients
  behave exactly as before — the visitor sees no "Leave out" section.
- `order_items.removed_ingredients` defaults to '' so all existing order items remain valid.
- No existing columns are dropped or renamed. No data migration required.

## Important Notes
1. `ON DELETE CASCADE` on `dish_removable_ingredients.dish_id` ensures ingredients are
   removed when a dish is deleted.
2. `is_active` lets hosts retire an ingredient without deleting it — existing orders keep
   their denormalised text.
3. The `removed_ingredients` column on `order_items` stores denormalised labels (not IDs)
   so historical orders remain readable even if ingredient rows are later deleted.
*/

-- ─── Create dish_removable_ingredients table ───
CREATE TABLE IF NOT EXISTS dish_removable_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dish_removable_ingredients_dish_id_idx ON dish_removable_ingredients(dish_id);
CREATE INDEX IF NOT EXISTS dish_removable_ingredients_dish_id_active_idx ON dish_removable_ingredients(dish_id) WHERE is_active = true;

ALTER TABLE dish_removable_ingredients ENABLE ROW LEVEL SECURITY;

-- service_role (edge functions) needs full access
GRANT SELECT, INSERT, UPDATE, DELETE ON dish_removable_ingredients TO service_role;

-- Visitors (anon) need to read active ingredients; authenticated hosts need to read all their own
GRANT SELECT ON dish_removable_ingredients TO anon, authenticated;
-- Hosts need write access
GRANT INSERT, UPDATE, DELETE ON dish_removable_ingredients TO authenticated;

-- SELECT: anon can read active ingredients; authenticated hosts can read all their own
DROP POLICY IF EXISTS "read_removable_ingredients" ON dish_removable_ingredients;
CREATE POLICY "read_removable_ingredients"
ON dish_removable_ingredients FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  OR EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_removable_ingredients.dish_id
    AND r.owner_id = auth.uid()
  )
);

-- INSERT: host can insert ingredients for dishes they own
DROP POLICY IF EXISTS "insert_own_removable_ingredients" ON dish_removable_ingredients;
CREATE POLICY "insert_own_removable_ingredients"
ON dish_removable_ingredients FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_removable_ingredients.dish_id
    AND r.owner_id = auth.uid()
  )
);

-- UPDATE: host can update ingredients for dishes they own
DROP POLICY IF EXISTS "update_own_removable_ingredients" ON dish_removable_ingredients;
CREATE POLICY "update_own_removable_ingredients"
ON dish_removable_ingredients FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_removable_ingredients.dish_id
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_removable_ingredients.dish_id
    AND r.owner_id = auth.uid()
  )
);

-- DELETE: host can delete ingredients for dishes they own
DROP POLICY IF EXISTS "delete_own_removable_ingredients" ON dish_removable_ingredients;
CREATE POLICY "delete_own_removable_ingredients"
ON dish_removable_ingredients FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_removable_ingredients.dish_id
    AND r.owner_id = auth.uid()
  )
);

-- ─── Add removed_ingredients column to order_items ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'removed_ingredients') THEN
    ALTER TABLE order_items ADD COLUMN removed_ingredients text NOT NULL DEFAULT '';
  END IF;
END $$;
